using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using FirebaseAdmin;
using FirebaseAdmin.Auth;
using Google.Apis.Auth.OAuth2;
using Google.Cloud.Firestore;
using Microsoft.AspNetCore.Mvc;
using ProjectSync.Api.Services;
using ProjectSync.Api.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddHttpClient();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowLocalhost", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Register FirestoreDb in DI
var projectId = builder.Configuration["Firebase:ProjectId"] ?? "project-compass-198db";
var firebaseCredPath = builder.Configuration["Firebase:CredentialsPath"] ?? "firebase-credentials.json";
var fullCredPath = Path.Combine(Directory.GetCurrentDirectory(), firebaseCredPath);
var pythonAiBaseUrl = builder.Configuration["PythonAI:BaseUrl"] ?? "http://localhost:8000";

if (File.Exists(fullCredPath))
{
    builder.Services.AddSingleton(sp =>
    {
        return new FirestoreDbBuilder
        {
            ProjectId = projectId,
            Credential = GoogleCredential.FromFile(fullCredPath)
        }.Build();
    });
}
else
{
    builder.Services.AddSingleton(sp => FirestoreDb.Create(projectId));
}

builder.Services.AddAuthorization();
builder.Services.AddSingleton<IEventDispatcher, EventDispatcher>();
builder.Services.AddSingleton<INotificationService, NotificationService>();

var app = builder.Build();

app.UseExceptionHandler(exceptionHandlerApp =>
{
    exceptionHandlerApp.Run(async context =>
    {
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";
        var exceptionHandlerPathFeature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerPathFeature>();
        if (exceptionHandlerPathFeature?.Error is Exception ex)
        {
            var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
            logger.LogError(ex, "An unhandled exception occurred.");
            await context.Response.WriteAsJsonAsync(new { error = "An internal server error occurred.", message = ex.Message });
        }
    });
});

app.UseCors("AllowLocalhost");
app.UseRouting();
// app.UseAuthentication();
// app.UseAuthorization();

// Subscribe NotificationService to EventDispatcher on app startup
var eventDispatcher = app.Services.GetRequiredService<IEventDispatcher>();
var notificationService = app.Services.GetRequiredService<INotificationService>();
eventDispatcher.Subscribe<SystemEvent>(async sysEvent => await notificationService.HandleEventAsync(sysEvent));

// ================================================================
// HELPER: Proxy request to Python AI service
// ================================================================
async Task<IResult> ProxyToPythonAI(
    string endpoint,
    object requestBody,
    IHttpClientFactory httpClientFactory,
    ILogger<Program> logger,
    object fallbackPayload = null)
{
    try
    {
        var client = httpClientFactory.CreateClient();
        var json = JsonSerializer.Serialize(requestBody);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await client.PostAsync($"{pythonAiBaseUrl}{endpoint}", content);
        var body = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            logger.LogError("Python AI service error at {Endpoint}: {Status} {Body}", endpoint, response.StatusCode, body);
            if (fallbackPayload != null) return Results.Ok(fallbackPayload);
            return Results.Problem($"AI service error: {response.StatusCode}");
        }
        return Results.Content(body, "application/json");
    }
    catch (HttpRequestException ex)
    {
        logger.LogError(ex, "Python AI service unreachable at {Url}", pythonAiBaseUrl);
        if (fallbackPayload != null) return Results.Ok(fallbackPayload);
        return Results.Problem("AI service is offline. Please start the Python AI microservice (run Backend/ai-service/start.bat).");
    }
}


// ================================================================
// AI ENDPOINTS — Proxied to Python service
// ================================================================

app.MapPost("/api/pmo/schedule-panels", async (
    [FromForm] IFormFile timetable,
    [FromForm] IFormFile expertise,
    [FromForm] IFormFile projects,
    [FromForm] int panels,
    [FromForm] int teachers_per_panel,
    [FromForm] int duration,
    [FromForm] string days,
    [FromForm] string start_time,
    [FromForm] string end_time,
    IHttpClientFactory httpClientFactory,
    Microsoft.Extensions.Configuration.IConfiguration config,
    ILogger<Program> logger) =>
{
    var pythonAiBaseUrl = config["PythonAI:BaseUrl"] ?? "http://localhost:8000";
    var client = httpClientFactory.CreateClient();
    
    using var content = new MultipartFormDataContent();
    
    if (timetable != null)
        content.Add(new StreamContent(timetable.OpenReadStream()), "timetable", timetable.FileName);
    if (expertise != null)
        content.Add(new StreamContent(expertise.OpenReadStream()), "expertise", expertise.FileName);
    if (projects != null)
        content.Add(new StreamContent(projects.OpenReadStream()), "projects", projects.FileName);
        
    content.Add(new StringContent(panels.ToString()), "panels");
    content.Add(new StringContent(teachers_per_panel.ToString()), "teachers_per_panel");
    content.Add(new StringContent(duration.ToString()), "duration");
    content.Add(new StringContent(days), "days");
    content.Add(new StringContent(start_time), "start_time");
    content.Add(new StringContent(end_time), "end_time");
    
    try
    {
        var response = await client.PostAsync($"{pythonAiBaseUrl}/ai/schedule-panels", content);
        var responseString = await response.Content.ReadAsStringAsync();
        
        var fallbackSchedule = new[]
        {
            new
            {
                panel_name = "Fallback Panel (Rule-Based)",
                domains = "General",
                members = new[] { "Fallback Supervisor 1", "Fallback Supervisor 2" },
                projects = new[]
                {
                    new
                    {
                        Project = "Fallback Project Assignment",
                        Day = days.Split(',').FirstOrDefault()?.Trim() ?? "Wednesday",
                        Time = start_time,
                        Teachers = new[] { "Fallback Supervisor 1" },
                        Excluded_busy = new string[0],
                        Overbooked = false
                    }
                }
            }
        };

        if (response.IsSuccessStatusCode)
        {
            return Results.Content(responseString, "application/json");
        }
        
        logger.LogError("AI Service scheduling failed. Status: {Status}, Body: {Body}", response.StatusCode, responseString);
        return Results.Ok(fallbackSchedule);
    }
    catch (HttpRequestException ex)
    {
        logger.LogError(ex, "Failed to connect to AI Service for scheduling.");
        var fallbackSchedule = new[]
        {
            new
            {
                panel_name = "Fallback Panel (Rule-Based)",
                domains = "General",
                members = new[] { "Fallback Supervisor 1", "Fallback Supervisor 2" },
                projects = new[]
                {
                    new
                    {
                        Project = "Fallback Project Assignment",
                        Day = days.Split(',').FirstOrDefault()?.Trim() ?? "Wednesday",
                        Time = start_time,
                        Teachers = new[] { "Fallback Supervisor 1" },
                        Excluded_busy = new string[0],
                        Overbooked = false
                    }
                }
            }
        };
        return Results.Ok(fallbackSchedule);
    }
}).DisableAntiforgery().Accepts<MultipartFormDataContent>("multipart/form-data");


app.MapPost("/api/ai/extract-tags", async (ExtractTagsRequest request, IHttpClientFactory httpClientFactory, ILogger<Program> logger) =>
{
    if (string.IsNullOrWhiteSpace(request.Abstract) || request.Abstract.Length < 10)
        return Results.BadRequest(new { error = "Abstract is missing or too short." });
    var tagsFallback = new { tags = new[] { "AI", "Software Engineering", "Web", "System Design" } };
    return await ProxyToPythonAI("/ai/extract-tags", new { @abstract = request.Abstract }, httpClientFactory, logger, tagsFallback);
});

app.MapPost("/api/ai/analyze-similarity", async (AnalyzeSimilarityRequest request, IHttpClientFactory httpClientFactory, ILogger<Program> logger) =>
{
    if (string.IsNullOrWhiteSpace(request.Abstract))
        return Results.BadRequest(new { error = "Abstract is required." });
    var similarityFallback = new { similarityScore = 15, similarProjects = new object[0] };
    return await ProxyToPythonAI("/ai/similarity-check", new { title = request.Abstract }, httpClientFactory, logger, similarityFallback);
});

app.MapPost("/api/ai/generate-feedback", async (GenerateFeedbackRequest request, IHttpClientFactory httpClientFactory, IConfiguration configuration, ILogger<Program> logger) =>
{
    if (string.IsNullOrEmpty(request.Title))
        return Results.BadRequest(new { error = "Title is required." });

    var apiKey = configuration["Gemini:ApiKey"] ?? Environment.GetEnvironmentVariable("AI_API_KEY");

    if (!string.IsNullOrEmpty(apiKey))
    {
        string documentContext = string.IsNullOrWhiteSpace(request.DocumentText)
            ? $"No uploaded document available. Base the evaluation on the project title '{request.Title}' and abstract '{request.Abstract}'."
            : $"Document Excerpt:\n{request.DocumentText.Substring(0, Math.Min(request.DocumentText.Length, 3000))}";

        string prompt = $@"
You are a senior academic evaluator grading a Final Year Project submission.
Project Title: {request.Title}
Milestone/Type: {request.MilestoneType ?? "Final"}
Abstract: {request.Abstract ?? "N/A"}
Context: {documentContext}

Provide a JSON evaluation summary matching this EXACT schema:
{{
  ""overallScore"": number (1-10),
  ""summary"": ""A concise 2-sentence summary of the evaluation"",
  ""strengths"": [""strength 1"", ""strength 2""],
  ""weaknesses"": [""weakness 1"", ""weakness 2""],
  ""suggestions"": [""suggestion 1"", ""suggestion 2""]
}}
Return ONLY valid JSON.
";

        var responseText = await CallGeminiAsync(prompt, apiKey, httpClientFactory, logger);
        if (!string.IsNullOrEmpty(responseText))
        {
            try
            {
                // Remove markdown code blocks if any
                responseText = responseText.Trim();
                if (responseText.StartsWith("```json", StringComparison.OrdinalIgnoreCase)) responseText = responseText.Substring(7);
                if (responseText.StartsWith("```")) responseText = responseText.Substring(3);
                if (responseText.EndsWith("```")) responseText = responseText.Substring(0, responseText.Length - 3);

                var jsonObj = JsonSerializer.Deserialize<JsonElement>(responseText.Trim());
                return Results.Ok(jsonObj);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to parse Gemini JSON output: {Output}", responseText);
            }
        }
    }

    // Fallback if API fails or no key
    var fallbackFeedback = new
    {
        overallScore = 7,
        summary = $"Project '{request.Title}' demonstrates standard implementation requirements. Focus the evaluation on system architecture and practical constraints.",
        strengths = new[] { "Clear project scope defined in the title", "Demonstrates awareness of academic requirements" },
        weaknesses = new[] { "Missing detailed technical documentation", "Requires further justification of methodology" },
        suggestions = new[] { "Review system architecture deeply during defense", "Ensure individual student contributions are clarified" },
        isFallback = true
    };
    return Results.Ok(fallbackFeedback);
});

app.MapPost("/api/ai/suggest-ideas", async (SuggestIdeasRequest request, IHttpClientFactory httpClientFactory, ILogger<Program> logger) =>
{
    if (string.IsNullOrEmpty(request.Domain))
        return Results.BadRequest(new { error = "Domain is required." });
    var benchmarkProjects = new[]
    {
        new { title = "Medi Assist: IoT Based Intelligent", abstractText = "Web Application — Ms. Azka Mir" },
        new { title = "Tryonnix - AI & IoT Based Virtual Try-on Platform", abstractText = "Information System — Dr. Sabeen Javaid" },
        new { title = "ADANA (CGI ads creation on footwear industry)", abstractText = "Database Management System — Mr. Ameer Hamza" },
        new { title = "AI Powered Smart Glasses For ASD", abstractText = "Machine and Deep Learning — Ms. Mehak Tanveer" },
        new { title = "USKT Smart Service Desk", abstractText = "Information System — Mr. Ameer Hamza" },
        new { title = "SMARTVISION HELMET AI-Powered 3D Navigation", abstractText = "Artificial Intelligence — Ms. Mehak Tanveer" },
        new { title = "SkillSphere", abstractText = "Information System — Rizwan Farukh" },
        new { title = "VIONEX (AI stick for blind)", abstractText = "Database Management System — Mr. Ameer Hamza" },
        new { title = "Sentri Hat", abstractText = "Database Management System — Irfan Shabbir" },
        new { title = "AI voice assistant and Sentiment Analysis", abstractText = "Information System — Mr. Ameer Hamza" },
        new { title = "PetPace - Smart IoT Collar", abstractText = "Artificial Intelligence — Ms. Azka Mir" },
        new { title = "Smart Bionic Arm with IoT Integration", abstractText = "Artificial Intelligence — Ms. Ayesha Saddiqa" },
        new { title = "AI-Based Mobile App for Diabetic Patients", abstractText = "Web Application — Faraz" },
        new { title = "Final Year Project Automation", abstractText = "Information System — Ms. Shimza Butt" },
        new { title = "AI-Powered Prediction of DNA Mutation Pathogenicity", abstractText = "Database Management System — Mr. Ameer Hamza" },
        new { title = "EMG Based AI Mute to Speech Translator", abstractText = "Software Project Management — Almas Aina" },
        new { title = "E-Pharmacy A Smart Medicine Ordering System", abstractText = "Artificial Intelligence — Tayyab Ahmed" },
        new { title = "CampusCare", abstractText = "Information System — Ms. Maryum" },
        new { title = "AI CAREERSUITE", abstractText = "Information System — Mr. Ameer Hamza" },
        new { title = "BuildCost: Smart Construction Estimation App", abstractText = "Web Application — Mamuna Nawaz" }
    };
    var fallbackIdeas = new { ideas = benchmarkProjects.Select(p => new { title = p.title, @abstract = p.abstractText }).Take(3) };
    return await ProxyToPythonAI("/ai/suggest-ideas", new { domain = request.Domain }, httpClientFactory, logger, fallbackIdeas);
});

// ================================================================
// MODULE 1: SUPERVISOR RECOMMENDATION ENGINE
// POST /api/proposals/recommend
// ================================================================
app.MapPost("/api/proposals/recommend", async (
    RecommendRequest request,
    IHttpClientFactory httpClientFactory,
    FirestoreDb db,
    ILogger<Program> logger) =>
{
    if (string.IsNullOrWhiteSpace(request.Title))
        return Results.BadRequest(new { error = "Project title is required." });

    try
    {
        // 1. Fetch live supervisor data from Firestore
        var supervisorQuery = db.Collection("users").WhereEqualTo("role", "supervisor");
        var supervisorSnap = await supervisorQuery.GetSnapshotAsync();

        // 2. Fetch current group counts per supervisor
        var groupsSnap = await db.Collection("groups").GetSnapshotAsync();
        var supervisorGroupCounts = new Dictionary<string, int>();
        foreach (var gDoc in groupsSnap.Documents)
        {
            if (gDoc.ContainsField("supervisorId"))
            {
                var sid = gDoc.GetValue<string>("supervisorId");
                if (!string.IsNullOrEmpty(sid))
                    supervisorGroupCounts[sid] = supervisorGroupCounts.GetValueOrDefault(sid, 0) + 1;
            }
        }

        // 3. Build supervisor data list for Python
        var supervisorData = supervisorSnap.Documents.Select(d => new
        {
            id = d.Id,
            name = d.ContainsField("name") ? d.GetValue<string>("name") : "",
            expertise = d.ContainsField("expertise") ? d.GetValue<string>("expertise") : "",
            department = d.ContainsField("department") ? d.GetValue<string>("department") : "CS",
            maxGroups = d.ContainsField("maxGroups") ? (int)d.GetValue<long>("maxGroups") : 5,
            currentGroups = supervisorGroupCounts.GetValueOrDefault(d.Id, 0)
        }).ToList();

        // 4. Proxy to Python AI with live data
        var pyPayload = new
        {
            title = request.Title,
            @abstract = request.Abstract ?? "",
            tags = request.Tags ?? new List<string>(),
            supervisor_data = supervisorData
        };

        var fallbackRecommendations = new { recommendations = supervisorData.Take(2).Select(s => new {
            id = s.id,
            name = s.name,
            department = s.department,
            matchPercentage = 75,
            matchedSkills = new[] { "General Project Guidance" },
            maxGroups = s.maxGroups,
            activeGroupsCount = s.currentGroups
        }) };

        return await ProxyToPythonAI("/ai/recommend-supervisors", pyPayload, httpClientFactory, logger, fallbackRecommendations);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Supervisor recommendation failed.");
        var fallbackRecommendations = new { recommendations = new object[0] };
        return Results.Ok(fallbackRecommendations);
    }
});

// ================================================================
// MODULE 2: PANEL SCHEDULING
// POST /api/pmo/panels/create
// ================================================================
app.MapPost("/api/pmo/panels/create", async (
    CreatePanelRequest request,
    FirestoreDb db,
    HttpContext context,
    ILogger<Program> logger) =>
{
    var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
    if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        return Results.Unauthorized();

    try
    {
        var token = authHeader.Substring("Bearer ".Length);
        var decodedToken = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(token);
        var uid = decodedToken.Uid;

        var userDoc = await db.Collection("users").Document(uid).GetSnapshotAsync();
        if (!userDoc.Exists) return Results.Unauthorized();
        var role = userDoc.GetValue<string>("role");
        if (role != "pmo" && role != "admin") return Results.StatusCode(403);

        if (string.IsNullOrWhiteSpace(request.PanelName))
            return Results.BadRequest(new { error = "Panel name is required." });

        var panelData = new Dictionary<string, object>
        {
            { "panelName", request.PanelName },
            { "memberIds", request.MemberIds ?? new List<string>() },
            { "scheduledDate", request.ScheduledDate ?? "" },
            { "timeSlot", request.TimeSlot ?? "" },
            { "venueOrLink", request.VenueOrLink ?? "" },
            { "createdBy", uid },
            { "createdAt", FieldValue.ServerTimestamp },
            { "status", "active" }
        };

        var docRef = await db.Collection("panels").AddAsync(panelData);
        logger.LogInformation("Panel created: {PanelId} by {Uid}", docRef.Id, uid);
        return Results.Ok(new { id = docRef.Id, message = "Panel created successfully." });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to create panel.");
        return Results.Problem("Failed to create panel.");
    }
});

// ================================================================
// PUT /api/pmo/panels/assign-groups
// ================================================================
app.MapPut("/api/pmo/panels/assign-groups", async (
    AssignGroupsRequest request,
    FirestoreDb db,
    HttpContext context,
    ILogger<Program> logger) =>
{
    var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
    if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        return Results.Unauthorized();

    try
    {
        var token = authHeader.Substring("Bearer ".Length);
        var decodedToken = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(token);
        var uid = decodedToken.Uid;

        var userDoc = await db.Collection("users").Document(uid).GetSnapshotAsync();
        if (!userDoc.Exists) return Results.Unauthorized();
        var role = userDoc.GetValue<string>("role");
        if (role != "pmo" && role != "admin") return Results.StatusCode(403);

        if (string.IsNullOrWhiteSpace(request.PanelId) || request.GroupIds == null || request.GroupIds.Count == 0)
            return Results.BadRequest(new { error = "PanelId and at least one GroupId are required." });

        var batch = db.StartBatch();
        foreach (var groupId in request.GroupIds)
        {
            var groupRef = db.Collection("groups").Document(groupId);
            batch.Update(groupRef, new Dictionary<string, object>
            {
                { "assignedPanelId", request.PanelId },
                { "evaluationStatus", "Pending" }
            });
        }
        await batch.CommitAsync();

        logger.LogInformation("Assigned {Count} groups to panel {PanelId}", request.GroupIds.Count, request.PanelId);
        return Results.Ok(new { message = $"{request.GroupIds.Count} group(s) assigned to panel.", panelId = request.PanelId });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to assign groups to panel.");
        return Results.Problem("Failed to assign groups.");
    }
});

// ================================================================
// GET /api/pmo/panels/oversight
// ================================================================
app.MapGet("/api/pmo/panels/oversight", async (
    FirestoreDb db,
    HttpContext context,
    ILogger<Program> logger) =>
{
    var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
    if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        return Results.Unauthorized();

    try
    {
        var token = authHeader.Substring("Bearer ".Length);
        var decodedToken = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(token);
        var uid = decodedToken.Uid;

        var userDoc = await db.Collection("users").Document(uid).GetSnapshotAsync();
        if (!userDoc.Exists) return Results.Unauthorized();
        var role = userDoc.GetValue<string>("role");
        if (role != "pmo" && role != "admin") return Results.StatusCode(403);

        // Fetch all panels
        var panelsSnap = await db.Collection("panels").GetSnapshotAsync();
        // Fetch all groups
        var groupsSnap = await db.Collection("groups").GetSnapshotAsync();
        // Fetch all evaluations
        var evalsSnap = await db.Collection("evaluations").GetSnapshotAsync();

        var evaluatedGroupIds = new HashSet<string>(
            evalsSnap.Documents
                .Select(d => d.ContainsField("groupId") ? d.GetValue<string>("groupId") : null)
                .Where(id => id != null)!
        );

        var panelOversight = panelsSnap.Documents.Select(p =>
        {
            var panelId = p.Id;
            var assignedGroups = groupsSnap.Documents
                .Where(g => g.ContainsField("assignedPanelId") && g.GetValue<string>("assignedPanelId") == panelId)
                .ToList();

            var completedCount = assignedGroups.Count(g =>
                (g.ContainsField("evaluationStatus") && g.GetValue<string>("evaluationStatus") == "Completed")
                || evaluatedGroupIds.Contains(g.Id)
            );

            var memberIds = p.ContainsField("memberIds")
                ? p.GetValue<List<string>>("memberIds")
                : new List<string>();

            return new
            {
                id = panelId,
                panelName = p.ContainsField("panelName") ? p.GetValue<string>("panelName") : "",
                scheduledDate = p.ContainsField("scheduledDate") ? p.GetValue<string>("scheduledDate") : "",
                timeSlot = p.ContainsField("timeSlot") ? p.GetValue<string>("timeSlot") : "",
                venueOrLink = p.ContainsField("venueOrLink") ? p.GetValue<string>("venueOrLink") : "",
                memberIds,
                totalGroups = assignedGroups.Count,
                completedGroups = completedCount,
                pendingGroups = assignedGroups.Count - completedCount,
                status = p.ContainsField("status") ? p.GetValue<string>("status") : "active",
                groups = assignedGroups.Select(g => new
                {
                    id = g.Id,
                    name = g.ContainsField("name") ? g.GetValue<string>("name") : "",
                    evaluationStatus = g.ContainsField("evaluationStatus") ? g.GetValue<string>("evaluationStatus") : "Pending",
                    isEvaluated = evaluatedGroupIds.Contains(g.Id)
                }).ToList()
            };
        }).ToList();

        return Results.Ok(panelOversight);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to fetch panel oversight.");
        return Results.Problem("Failed to fetch oversight data.");
    }
});

// ================================================================
// EXISTING ENDPOINTS (unchanged)
// ================================================================

try {
    if (FirebaseApp.DefaultInstance == null)
    {
        var appOptions = new AppOptions { ProjectId = projectId };
        if (File.Exists(fullCredPath)) {
            appOptions.Credential = GoogleCredential.FromFile(fullCredPath);
            Console.WriteLine("Firebase Admin initialized using local firebase-credentials.json");
        } else {
            Console.WriteLine("Warning: firebase-credentials.json not found. Using default credentials.");
        }
        FirebaseApp.Create(appOptions);
    }
} catch (Exception ex) {
    Console.WriteLine($"Firebase Admin Init Warning: {ex.Message}");
}

app.MapPost("/api/submissions", async (SubmissionRequest req, FirestoreDb db, IEventDispatcher dispatcher, ILogger<Program> logger) =>
{
    if (string.IsNullOrEmpty(req.GroupId) || string.IsNullOrEmpty(req.DocumentUrl))
        return Results.BadRequest(new { error = "GroupId and DocumentUrl are required." });
    try
    {
        var submissionData = new Dictionary<string, object>
        {
            { "groupId", req.GroupId },
            { "milestoneType", req.Phase ?? "proposal" },
            { "fileUrl", req.DocumentUrl },
            { "submittedBy", req.SubmittedByUid },
            { "status", "uploaded" },
            { "submittedAt", FieldValue.ServerTimestamp }
        };
        var docRef = await db.Collection("submissions").AddAsync(submissionData);

        // Notify Supervisor (Fetching supervisorId from group)
        try {
            var groupDoc = await db.Collection("groups").Document(req.GroupId).GetSnapshotAsync();
            if (groupDoc.Exists && groupDoc.TryGetValue<string>("supervisorId", out var supervisorId) && !string.IsNullOrEmpty(supervisorId)) {
                dispatcher.Dispatch(new SystemEvent {
                    EventType = "DOCUMENT_UPLOADED",
                    RecipientId = supervisorId,
                    SenderId = req.SubmittedByUid,
                    Title = "New Document Submitted",
                    Message = $"Group {req.GroupId} has uploaded a new {req.Phase ?? "proposal"} document.",
                    RedirectUrl = "/supervisor/reviews"
                });
            }
        } catch {}

        return Results.Ok(new { message = "Submission saved successfully", id = docRef.Id });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to save submission.");
        return Results.Problem($"Backend Error: {ex.Message}");
    }
});

app.MapGet("/api/submissions/group/{groupId}", async (string groupId, FirestoreDb db, HttpContext context, ILogger<Program> logger) =>
{
    if (string.IsNullOrWhiteSpace(groupId)) return Results.BadRequest(new { error = "GroupId is required." });
    var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
    if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ")) return Results.Unauthorized();
    try
    {
        var token = authHeader.Substring("Bearer ".Length);
        var decodedToken = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(token);
        var uid = decodedToken.Uid;
        var userDoc = await db.Collection("users").Document(uid).GetSnapshotAsync();
        if (!userDoc.Exists) return Results.Unauthorized();
        var role = userDoc.GetValue<string>("role");
        if (role == "student")
        {
            var userGroupId = userDoc.ContainsField("groupId") ? userDoc.GetValue<string>("groupId") : null;
            if (userGroupId != groupId) return Results.StatusCode(403);
        }
        else if (role == "supervisor")
        {
            var groupDoc = await db.Collection("groups").Document(groupId).GetSnapshotAsync();
            if (!groupDoc.Exists) return Results.NotFound(new { error = "Group not found." });
            var assignedSupervisorId = groupDoc.ContainsField("supervisorId") ? groupDoc.GetValue<string>("supervisorId") : null;
            if (assignedSupervisorId != uid) return Results.StatusCode(403);
        }
        else if (role != "pmo" && role != "admin" && role != "exam_cell" && role != "external_panel")
        {
            return Results.StatusCode(403);
        }
        var submissionsSnapshot = await db.Collection("submissions").WhereEqualTo("groupId", groupId).GetSnapshotAsync();
        var results = submissionsSnapshot.Documents.Select(d => { var dict = d.ToDictionary(); dict["id"] = d.Id; return dict; }).ToList();
        return Results.Ok(results);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to get submissions for group {GroupId}", groupId);
        return Results.Problem("An internal error occurred.");
    }
});

app.MapPost("/api/evaluations/group/{groupId}/evaluator/{evaluatorId}/share", async (string groupId, string evaluatorId, FirestoreDb db, HttpContext context, ILogger<Program> logger) =>
{
    var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
    if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ")) return Results.Unauthorized();
    try
    {
        var token = authHeader.Substring("Bearer ".Length);
        var decodedToken = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(token);
        var uid = decodedToken.Uid;
        var userDoc = await db.Collection("users").Document(uid).GetSnapshotAsync();
        if (!userDoc.Exists) return Results.Unauthorized();
        var role = userDoc.GetValue<string>("role");
        var evalsQuery = db.Collection("evaluations").WhereEqualTo("groupId", groupId).WhereEqualTo("evaluatorId", evaluatorId);
        var evalsSnap = await evalsQuery.GetSnapshotAsync();
        if (evalsSnap.Documents.Count == 0) return Results.NotFound("Evaluations not found.");
        var batch = db.StartBatch();
        foreach (var doc in evalsSnap.Documents)
        {
            var updateDict = new Dictionary<string, object>();
            if (role == "supervisor") { if (uid != evaluatorId) return Results.StatusCode(403); updateDict.Add("isSharedWithPMO", true); }
            else if (role == "pmo") { updateDict.Add("isSharedWithExamCell", true); }
            else if (role == "external_panel") { if (uid != evaluatorId) return Results.StatusCode(403); updateDict.Add("isSharedWithExamCell", true); }
            else if (role == "exam_cell") { updateDict.Add("isFinalized", true); }
            else { return Results.StatusCode(403); }
            batch.Update(doc.Reference, updateDict);
        }
        if (role == "exam_cell") {
            var groupRef = db.Collection("groups").Document(groupId);
            var groupDoc = await groupRef.GetSnapshotAsync();
            if (groupDoc.Exists) batch.Update(groupRef, new Dictionary<string, object> { { "isMarksShared", true } });
        }
        await batch.CommitAsync();
        return Results.Ok(new { message = "State updated successfully." });
    }
    catch (Exception ex) { logger.LogError(ex, "Failed to update state."); return Results.Problem("Internal error."); }
});

app.MapGet("/api/submissions/all", async (FirestoreDb db, HttpContext context, ILogger<Program> logger) =>
{
    var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
    if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ")) return Results.Unauthorized();
    try
    {
        var token = authHeader.Substring("Bearer ".Length);
        var decodedToken = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(token);
        var uid = decodedToken.Uid;
        var userDoc = await db.Collection("users").Document(uid).GetSnapshotAsync();
        if (!userDoc.Exists) return Results.Unauthorized();
        var role = userDoc.GetValue<string>("role");
        if (role != "pmo" && role != "admin" && role != "exam_cell" && role != "external_panel") return Results.StatusCode(403);
        var submissionsSnapshot = await db.Collection("submissions").GetSnapshotAsync();
        var results = submissionsSnapshot.Documents.Select(d => { var dict = d.ToDictionary(); dict["id"] = d.Id; return dict; }).ToList();
        return Results.Ok(results);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Error fetching all submissions");
        return Results.Problem(ex.Message);
    }
});

app.MapGet("/api/submissions/supervisor", async (FirestoreDb db, HttpContext context, ILogger<Program> logger) =>
{
    var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
    if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ")) return Results.Unauthorized();
    try
    {
        var token = authHeader.Substring("Bearer ".Length);
        var decodedToken = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(token);
        var uid = decodedToken.Uid;
        var userDoc = await db.Collection("users").Document(uid).GetSnapshotAsync();
        if (!userDoc.Exists) return Results.Unauthorized();
        var role = userDoc.GetValue<string>("role");
        if (role != "supervisor" && role != "pmo" && role != "admin") return Results.StatusCode(403);
        var groupsSnapshot = await db.Collection("groups").WhereEqualTo("supervisorId", uid).GetSnapshotAsync();
        var groupIds = groupsSnapshot.Documents.Select(d => d.Id).ToList();
        if (groupIds.Count == 0) return Results.Ok(new List<object>());
        var submissionsSnapshot = await db.Collection("submissions").WhereIn("groupId", groupIds).GetSnapshotAsync();
        var results = submissionsSnapshot.Documents.Select(d => { var dict = d.ToDictionary(); dict["id"] = d.Id; return dict; }).ToList();
        return Results.Ok(results);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Error fetching supervisor submissions");
        return Results.Problem(ex.Message);
    }
});

// ================================================================
// MODULE: NOTIFICATION SYSTEM
// ================================================================

app.MapGet("/api/notifications/stream", async (string userId, INotificationService notificationService, HttpContext context) =>
{
    context.Response.Headers.Add("Content-Type", "text/event-stream");
    var reader = notificationService.SubscribeToStream(userId);
    try
    {
        await foreach (var message in reader.ReadAllAsync(context.RequestAborted))
        {
            await context.Response.WriteAsync(message);
            await context.Response.Body.FlushAsync();
        }
    }
    catch (OperationCanceledException) { }
    finally
    {
        notificationService.UnsubscribeFromStream(userId);
    }
});

app.MapPut("/api/notifications/{id}/read", async (string id, FirestoreDb db) =>
{
    var docRef = db.Collection("notifications").Document(id);
    await docRef.UpdateAsync("isRead", true);
    return Results.Ok(new { success = true });
});

// ================================================================
// MODULE: EVALUATION SYSTEM V2
// ================================================================

// ─── Helpers ──────────────────────────────────────────────────────────────

/// <summary>
/// Resilient semester parser.
/// Treats 7, "7", "SEM_7", "7th", "Semester 7", "7th Semester" → SEM_7.
/// Everything else → SEM_8.
/// </summary>
static string ParseSemesterType(object? raw)
{
    var s = raw?.ToString()?.Trim().ToUpperInvariant() ?? "";
    if (s == "7" || s == "SEM_7" || s == "7TH" ||
        s.Contains("SEMESTER 7") || s.Contains("SEM 7") || s.StartsWith("7"))
        return "SEM_7";
    return "SEM_8";
}

static double GetRoleMax(string semesterType, string role) => (semesterType, role) switch
{
    ("SEM_7", "PMO")        => 5.0,
    ("SEM_7", "SUPERVISOR") => 30.0,
    ("SEM_7", "PANEL")      => 65.0,
    ("SEM_7", "EXTERNAL")   => 0.0,   // not allowed
    ("SEM_8", "PMO")        => 5.0,
    ("SEM_8", "SUPERVISOR") => 10.0,
    ("SEM_8", "PANEL")      => 35.0,
    ("SEM_8", "EXTERNAL")   => 50.0,
    _                       => 0.0,
};

static async Task<bool> IsEvaluatorAuthorized(
    FirestoreDb db, string uid, string userRole,
    string groupId, string evaluatorRole)
{
    var groupSnap = await db.Collection("groups").Document(groupId).GetSnapshotAsync();
    if (!groupSnap.Exists) return false;

    return evaluatorRole switch
    {
        "PMO"        => userRole == "pmo" || userRole == "admin",
        "SUPERVISOR" => groupSnap.ContainsField("supervisorId") &&
                        groupSnap.GetValue<string>("supervisorId") == uid,
        "PANEL"      => await IsPanelMember(db, uid, groupSnap),
        "EXTERNAL"   => groupSnap.ContainsField("externalPanelId") &&
                        groupSnap.GetValue<string>("externalPanelId") == uid,
        _            => false
    };
}

static async Task<bool> IsPanelMember(FirestoreDb db, string uid, DocumentSnapshot groupSnap)
{
    // Check via assignedPanelId → panels collection
    if (groupSnap.ContainsField("assignedPanelId"))
    {
        var panelId = groupSnap.GetValue<string>("assignedPanelId");
        if (!string.IsNullOrEmpty(panelId))
        {
            var panelSnap = await db.Collection("panels").Document(panelId).GetSnapshotAsync();
            if (panelSnap.Exists && panelSnap.ContainsField("memberIds"))
            {
                var members = panelSnap.GetValue<List<string>>("memberIds");
                if (members.Contains(uid)) return true;
            }
        }
    }
    // Fallback: check externalPanelId (some groups use this for panel members)
    if (groupSnap.ContainsField("externalPanelId") &&
        groupSnap.GetValue<string>("externalPanelId") == uid)
        return true;
    return false;
}

// ─── POST /api/evaluations/v2/submit ─────────────────────────────────────

app.MapPost("/api/evaluations/v2/submit", async (
    SubmitScoreV2Request req,
    FirestoreDb db,
    HttpContext context,
    ILogger<Program> logger) =>
{
    // Auth
    var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
    if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        return Results.Unauthorized();

    try
    {
        var token = authHeader.Substring("Bearer ".Length);
        var decoded = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(token);
        var uid = decoded.Uid;

        var userSnap = await db.Collection("users").Document(uid).GetSnapshotAsync();
        if (!userSnap.Exists) return Results.Unauthorized();
        var userRole = userSnap.GetValue<string>("role");

        // Validate evaluator role string
        var role = req.EvaluatorRole?.ToUpperInvariant() ?? "";
        if (role != "PMO" && role != "SUPERVISOR" && role != "PANEL" && role != "EXTERNAL")
            return Results.BadRequest(new { error = "Invalid evaluatorRole. Must be PMO, SUPERVISOR, PANEL, or EXTERNAL." });

        // Authorization: is this evaluator permitted for this group+role?
        if (!await IsEvaluatorAuthorized(db, uid, userRole, req.GroupId, role))
        {
            logger.LogWarning("Unauthorized evaluation attempt: uid={Uid} role={Role} group={GroupId}", uid, role, req.GroupId);
            return Results.StatusCode(403);
        }

        // Fetch group to determine semester
        var groupSnap = await db.Collection("groups").Document(req.GroupId).GetSnapshotAsync();
        if (!groupSnap.Exists)
            return Results.NotFound(new { error = "Group not found." });

        object? rawSem = groupSnap.ContainsField("semester") ? groupSnap.GetValue<object>("semester") : null;
        var semesterType = ParseSemesterType(rawSem);

        // SEM_7 does not allow EXTERNAL
        if (semesterType == "SEM_7" && role == "EXTERNAL")
            return Results.BadRequest(new { error = "EXTERNAL evaluation is not permitted for Semester 7 groups." });

        // Determine or create master evaluation record
        var evalDocId = $"{req.GroupId}_{semesterType}";
        var evalRef = db.Collection("project_evaluations").Document(evalDocId);
        var evalSnap = await evalRef.GetSnapshotAsync();

        // Gate: locked check
        if (evalSnap.Exists && evalSnap.ContainsField("isLocked") &&
            evalSnap.GetValue<bool>("isLocked"))
        {
            return Results.Json(
                new { error = "This evaluation has been locked by PMO and cannot be modified." },
                statusCode: 403);
        }


        // Server-side criteria sum & cap enforcement
        if (req.Evaluations == null || req.Evaluations.Count == 0)
            return Results.BadRequest(new { error = "Evaluations must not be empty." });

        var roleMax = GetRoleMax(semesterType, role);
        foreach (var eval in req.Evaluations)
        {
            var score = Math.Round(eval.Criteria.Values.Sum(), 2);
            if (score > roleMax)
                return Results.BadRequest(new { error = $"Score {score} exceeds maximum {roleMax} for student {eval.StudentName}." });
            if (score < 0)
                return Results.BadRequest(new { error = $"Score cannot be negative for student {eval.StudentName}." });
        }

        // Upsert master evaluation record (idempotent)
        if (!evalSnap.Exists)
        {
            var projectId = groupSnap.ContainsField("projectId") ? groupSnap.GetValue<string>("projectId") : null;
            await evalRef.SetAsync(new Dictionary<string, object>
            {
                { "groupId", req.GroupId },
                { "projectId", projectId ?? "" },
                { "semesterType", semesterType },
                { "isLocked", false },
                { "createdAt", FieldValue.ServerTimestamp }
            });
        }

        var evaluatorName = userSnap.ContainsField("name") ? userSnap.GetValue<string>("name") : uid;
        var batch = db.StartBatch();

        foreach (var eval in req.Evaluations)
        {
            var score = Math.Round(eval.Criteria.Values.Sum(), 2);
            var scoreDocId = $"{req.GroupId}_{eval.StudentId}_{uid}_{role}";
            var scoreRef = db.Collection("evaluation_scores").Document(scoreDocId);

            batch.Set(scoreRef, new Dictionary<string, object>
            {
                { "evaluationId",   evalDocId },
                { "groupId",        req.GroupId },
                { "studentId",      eval.StudentId },
                { "studentName",    eval.StudentName },
                { "studentRollNo",  eval.StudentRollNo },
                { "evaluatorId",    uid },
                { "evaluatorName",  evaluatorName },
                { "evaluatorRole",  role },
                { "semesterType",   semesterType },
                { "score",          score },
                { "maxScore",       roleMax },
                { "criteria",       eval.Criteria.ToDictionary(kv => kv.Key, kv => (object)kv.Value) },
                { "feedback",       eval.Feedback ?? "" },
                { "submittedAt",    FieldValue.ServerTimestamp }
            });
        }

        await batch.CommitAsync();

        logger.LogInformation("Scores submitted: group={GroupId} role={Role} evaluations={Count} semester={Sem} by {Uid}",
            req.GroupId, role, req.Evaluations.Count, semesterType, uid);

        return Results.Ok(new
        {
            success = true,
            maxScore = roleMax,
            semesterType
        });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to submit evaluation score.");
        return Results.Problem("Failed to submit score.");
    }
});

// ─── GET /api/evaluations/v2/group/{groupId} ─────────────────────────────

app.MapGet("/api/evaluations/v2/group/{groupId}", async (
    string groupId,
    FirestoreDb db,
    HttpContext context,
    ILogger<Program> logger) =>
{
    var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
    if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        return Results.Unauthorized();

    try
    {
        var token = authHeader.Substring("Bearer ".Length);
        var decoded = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(token);
        var uid = decoded.Uid;

        var userSnap = await db.Collection("users").Document(uid).GetSnapshotAsync();
        if (!userSnap.Exists) return Results.Unauthorized();
        var userRole = userSnap.GetValue<string>("role");

        // Students can only see scores for their own group
        if (userRole == "student")
        {
            var groupSnap = await db.Collection("groups").Document(groupId).GetSnapshotAsync();
            if (!groupSnap.Exists) return Results.NotFound();
            var isMarksShared = groupSnap.ContainsField("isMarksShared") && groupSnap.GetValue<bool>("isMarksShared");
            if (!isMarksShared) return Results.StatusCode(403);
        }

        var scoresSnap = await db.Collection("evaluation_scores")
            .WhereEqualTo("groupId", groupId)
            .GetSnapshotAsync();

        var scores = scoresSnap.Documents.Select(d =>
        {
            var dict = d.ToDictionary();
            dict["id"] = d.Id;
            return dict;
        }).ToList();

        var masterSnap = await db.Collection("project_evaluations")
            .WhereEqualTo("groupId", groupId)
            .GetSnapshotAsync();

        var master = masterSnap.Documents.Select(d =>
        {
            var dict = d.ToDictionary();
            dict["id"] = d.Id;
            return dict;
        }).FirstOrDefault();

        return Results.Ok(new { master, scores });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to fetch evaluation data for group {GroupId}", groupId);
        return Results.Problem("Failed to fetch evaluation data.");
    }
});

// ─── GET /api/evaluations/v2/group/{groupId}/computed ────────────────────

app.MapGet("/api/evaluations/v2/group/{groupId}/computed", async (
    string groupId,
    FirestoreDb db,
    HttpContext context,
    ILogger<Program> logger) =>
{
    var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
    if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        return Results.Unauthorized();

    try
    {
        var token = authHeader.Substring("Bearer ".Length);
        var decoded = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(token);
        var uid = decoded.Uid;

        var userSnap = await db.Collection("users").Document(uid).GetSnapshotAsync();
        if (!userSnap.Exists) return Results.Unauthorized();

        // Fetch group to get semester & panel size
        var groupSnap = await db.Collection("groups").Document(groupId).GetSnapshotAsync();
        if (!groupSnap.Exists) return Results.NotFound(new { error = "Group not found." });

        object? rawSem = groupSnap.ContainsField("semester") ? groupSnap.GetValue<object>("semester") : null;
        var semesterType = ParseSemesterType(rawSem);

        // How many panel members are expected?
        int panelTotalExpected = 0;
        if (groupSnap.ContainsField("assignedPanelId"))
        {
            var panelId = groupSnap.GetValue<string>("assignedPanelId");
            if (!string.IsNullOrEmpty(panelId))
            {
                var panelSnap = await db.Collection("panels").Document(panelId).GetSnapshotAsync();
                if (panelSnap.Exists && panelSnap.ContainsField("memberIds"))
                    panelTotalExpected = panelSnap.GetValue<List<string>>("memberIds").Count;
            }
        }

        // Fetch master record
        var masterDocId = $"{groupId}_{semesterType}";
        var masterSnap = await db.Collection("project_evaluations").Document(masterDocId).GetSnapshotAsync();
        var isLocked = masterSnap.Exists && masterSnap.ContainsField("isLocked") && masterSnap.GetValue<bool>("isLocked");

        var studentsMap = new Dictionary<string, StudentComputed>();

        // Pre-fill from group members so all students are represented even without evaluations
        if (groupSnap.ContainsField("members"))
        {
            var members = groupSnap.GetValue<List<Dictionary<string, object>>>("members");
            foreach (var m in members)
            {
                var sId = m.ContainsKey("userId") ? m["userId"]?.ToString() : null;
                if (!string.IsNullOrEmpty(sId))
                {
                    studentsMap[sId] = new StudentComputed
                    {
                        StudentId = sId,
                        StudentName = m.ContainsKey("name") ? m["name"]?.ToString() ?? "Unknown" : "Unknown",
                        StudentRollNo = m.ContainsKey("rollNumber") ? m["rollNumber"]?.ToString() ?? "" : (m.ContainsKey("email") ? m["email"]?.ToString() ?? "" : "")
                    };
                }
            }
        }

        // Fetch all scores for this group
        var scoresSnap = await db.Collection("evaluation_scores")
            .WhereEqualTo("groupId", groupId)
            .GetSnapshotAsync();

        foreach (var doc in scoresSnap.Documents)
        {
            var sId = doc.ContainsField("studentId") ? doc.GetValue<string>("studentId") : null;
            if (string.IsNullOrEmpty(sId)) continue; // skip legacy group-level scores if any

            if (!studentsMap.ContainsKey(sId))
            {
                studentsMap[sId] = new StudentComputed
                {
                    StudentId = sId,
                    StudentName = doc.ContainsField("studentName") ? doc.GetValue<string>("studentName") : "Unknown",
                    StudentRollNo = doc.ContainsField("studentRollNo") ? doc.GetValue<string>("studentRollNo") : ""
                };
            }

            var student = studentsMap[sId];
            var role = doc.ContainsField("evaluatorRole") ? doc.GetValue<string>("evaluatorRole") : "";
            var rawScore = doc.ContainsField("score") ? Convert.ToDouble(doc.GetValue<object>("score")) : 0.0;

            switch (role)
            {
                case "PMO":        student.PmoScore = Math.Round(rawScore, 2); break;
                case "SUPERVISOR": student.SupervisorScore = Math.Round(rawScore, 2); break;
                case "EXTERNAL":   student.ExternalScore = Math.Round(rawScore, 2); break;
                case "PANEL":      student.PanelRawScores.Add(Math.Round(rawScore, 2)); break;
            }
        }

        // Build computed student objects
        var studentsResponse = studentsMap.Values.Select(s =>
        {
            var panelSubmittedCount = s.PanelRawScores.Count;
            var panelAvg = panelSubmittedCount > 0 ? Math.Round(s.PanelRawScores.Sum() / panelSubmittedCount, 2) : 0.0;
            
            double total, internal2Total;
            if (semesterType == "SEM_7")
            {
                internal2Total = 0;
                total = Math.Round(s.PmoScore + s.SupervisorScore + panelAvg, 2);
            }
            else
            {
                internal2Total = Math.Round(s.PmoScore + s.SupervisorScore + panelAvg, 2);
                total = Math.Round(internal2Total + s.ExternalScore, 2);
            }

            return new
            {
                studentId = s.StudentId,
                studentName = s.StudentName,
                studentRollNo = s.StudentRollNo,
                pmoScore = s.PmoScore,
                supervisorScore = s.SupervisorScore,
                panelAvg,
                externalScore = s.ExternalScore,
                internalTotal = internal2Total,
                grandTotal = total,
                breakdown = new
                {
                    panelSubmissionsCount = panelSubmittedCount,
                    panelTotalExpected
                }
            };
        }).ToList();

        // Include all raw scores for client convenience if needed
        var allScores = scoresSnap.Documents.Select(d =>
        {
            var dict = d.ToDictionary();
            dict["id"] = d.Id;
            return dict;
        }).ToList();

        return Results.Ok(new
        {
            groupId,
            semesterType,
            isLocked,
            maxTotal = 100,
            students = studentsResponse,
            allScores // Keeping for backward compatibility or direct access
        });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to compute scores for group {GroupId}", groupId);
        return Results.Problem("Failed to compute scores.");
    }
});

// ─── POST /api/evaluations/v2/group/{groupId}/lock ───────────────────────

app.MapPost("/api/evaluations/v2/group/{groupId}/lock", async (
    string groupId,
    FirestoreDb db,
    HttpContext context,
    ILogger<Program> logger) =>
{
    var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
    if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        return Results.Unauthorized();

    try
    {
        var token = authHeader.Substring("Bearer ".Length);
        var decoded = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(token);
        var uid = decoded.Uid;

        var userSnap = await db.Collection("users").Document(uid).GetSnapshotAsync();
        if (!userSnap.Exists) return Results.Unauthorized();
        var userRole = userSnap.GetValue<string>("role");
        if (userRole != "pmo" && userRole != "admin" && userRole != "exam_cell")
            return Results.StatusCode(403);

        var groupSnap = await db.Collection("groups").Document(groupId).GetSnapshotAsync();
        if (!groupSnap.Exists) return Results.NotFound(new { error = "Group not found." });

        object? rawSem = groupSnap.ContainsField("semester") ? groupSnap.GetValue<object>("semester") : null;
        var semesterType = ParseSemesterType(rawSem);
        var masterDocId = $"{groupId}_{semesterType}";

        var masterRef = db.Collection("project_evaluations").Document(masterDocId);
        await masterRef.SetAsync(
            new Dictionary<string, object> { { "isLocked", true }, { "lockedBy", uid }, { "lockedAt", FieldValue.ServerTimestamp } },
            SetOptions.MergeAll
        );

        logger.LogInformation("Evaluation locked: group={GroupId} semester={Sem} by {Uid}", groupId, semesterType, uid);
        return Results.Ok(new { success = true, groupId, semesterType, isLocked = true });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to lock evaluation for group {GroupId}", groupId);
        return Results.Problem("Failed to lock evaluation.");
    }
});

// ─── POST /api/evaluations/v2/publish/{groupId} ──────────────────────────

app.MapPost("/api/evaluations/v2/publish/{groupId}", async (
    string groupId,
    FirestoreDb db,
    HttpContext context,
    ILogger<Program> logger) =>
{
    var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
    if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        return Results.Unauthorized();

    try
    {
        var token = authHeader.Substring("Bearer ".Length);
        var decoded = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(token);
        var uid = decoded.Uid;

        var userSnap = await db.Collection("users").Document(uid).GetSnapshotAsync();
        if (!userSnap.Exists) return Results.Unauthorized();
        var userRole = userSnap.GetValue<string>("role");
        if (userRole != "exam_cell" && userRole != "admin")
            return Results.StatusCode(403);

        // Lock the evaluation first if not already locked
        var groupSnap = await db.Collection("groups").Document(groupId).GetSnapshotAsync();
        if (!groupSnap.Exists) return Results.NotFound(new { error = "Group not found." });

        object? rawSem = groupSnap.ContainsField("semester") ? groupSnap.GetValue<object>("semester") : null;
        var semesterType = ParseSemesterType(rawSem);
        var masterDocId = $"{groupId}_{semesterType}";

        var masterRef = db.Collection("project_evaluations").Document(masterDocId);
        await masterRef.SetAsync(
            new Dictionary<string, object> { { "isLocked", true }, { "publishedAt", FieldValue.ServerTimestamp } },
            SetOptions.MergeAll
        );

        // Set isMarksShared on the group → students can now see results
        var groupRef = db.Collection("groups").Document(groupId);
        await groupRef.UpdateAsync(new Dictionary<string, object>
        {
            { "isMarksShared", true },
            { "publishedBy", uid },
            { "publishedAt", FieldValue.ServerTimestamp }
        });

        logger.LogInformation("Results published: group={GroupId} semester={Sem} by {Uid}", groupId, semesterType, uid);
        return Results.Ok(new { success = true, groupId, isMarksShared = true });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to publish results for group {GroupId}", groupId);
        return Results.Problem("Failed to publish results.");
    }
});

// ─── POST /api/recommendations/supervisors ──────────────────────────

app.MapPost("/api/recommendations/supervisors", async (
    [FromForm] IFormFile? proposalDocument,
    [FromForm] string? projectTitle,
    [FromForm] string? abstractText,
    [FromForm] string? domain,
    FirestoreDb db,
    IHttpClientFactory httpClientFactory,
    ILogger<Program> logger) =>
{
    try
    {
        // 1. Fetch live supervisor data from Firestore
        var supervisorQuery = db.Collection("users").WhereEqualTo("role", "supervisor");
        var supervisorSnap = await supervisorQuery.GetSnapshotAsync();

        // 2. Fetch current group counts per supervisor
        var groupsSnap = await db.Collection("groups").GetSnapshotAsync();
        var supervisorGroupCounts = new Dictionary<string, int>();
        foreach (var gDoc in groupsSnap.Documents)
        {
            if (gDoc.ContainsField("supervisorId"))
            {
                var sid = gDoc.GetValue<string>("supervisorId");
                if (!string.IsNullOrEmpty(sid))
                    supervisorGroupCounts[sid] = supervisorGroupCounts.GetValueOrDefault(sid, 0) + 1;
            }
        }

        // 3. Build supervisor data list for Python
        var supervisors = supervisorSnap.Documents.Select(d => new Dictionary<string, object>
        {
            { "id", d.Id },
            { "name", d.ContainsField("name") ? d.GetValue<string>("name") : "" },
            { "email", d.ContainsField("email") ? d.GetValue<string>("email") : "" },
            { "expertise", d.ContainsField("expertise") ? 
                (d.GetValue<object>("expertise") is IList<object> list ? string.Join(", ", list) : d.GetValue<object>("expertise")?.ToString() ?? "") 
                : "" },
            { "department", d.ContainsField("department") ? d.GetValue<string>("department") : "CS" },
            { "maxGroups", d.ContainsField("maxGroups") ? (int)d.GetValue<long>("maxGroups") : 5 },
            { "activeGroupsCount", supervisorGroupCounts.GetValueOrDefault(d.Id, 0) }
        }).ToList();

        // 2. Prepare multipart request to forward to Python AI service
        var client = httpClientFactory.CreateClient();
        using var formData = new MultipartFormDataContent();
        
        if (proposalDocument != null)
        {
            var streamContent = new StreamContent(proposalDocument.OpenReadStream());
            streamContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(proposalDocument.ContentType);
            formData.Add(streamContent, "proposalDocument", proposalDocument.FileName);
        }
        
        if (!string.IsNullOrEmpty(projectTitle)) formData.Add(new StringContent(projectTitle), "projectTitle");
        if (!string.IsNullOrEmpty(abstractText)) formData.Add(new StringContent(abstractText), "abstractText");
        if (!string.IsNullOrEmpty(domain)) formData.Add(new StringContent(domain), "domain");
        
        // Pass supervisors as JSON string
        formData.Add(new StringContent(JsonSerializer.Serialize(supervisors)), "supervisors_json");

        var pythonAiBaseUrl = "http://localhost:8000"; // Fallback or read from config
        var response = await client.PostAsync($"{pythonAiBaseUrl}/ai/process-proposal-and-recommend", formData);
        var responseBody = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            logger.LogError("Python AI service failed: {Status} {Body}", response.StatusCode, responseBody);
            return Results.Problem("AI Service failed to process recommendation.");
        }

        var jsonOptions = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var pythonResult = JsonSerializer.Deserialize<JsonElement>(responseBody, jsonOptions);

        return Results.Ok(new { recommendations = pythonResult.GetProperty("recommendations") });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to recommend supervisors");
        return Results.Problem("Failed to recommend supervisors.");
    }
}).DisableAntiforgery().Accepts<object>("multipart/form-data");

app.Run();
async Task<string?> CallGeminiAsync(string prompt, string apiKey, IHttpClientFactory httpClientFactory, ILogger logger)
{
    try
    {
        var client = httpClientFactory.CreateClient();
        var requestUrl = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={apiKey}";
        
        var requestBody = new
        {
            contents = new[]
            {
                new { parts = new[] { new { text = prompt } } }
            },
            generationConfig = new { response_mime_type = "application/json" }
        };

        var response = await client.PostAsJsonAsync(requestUrl, requestBody);
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync();
            logger.LogError("Gemini API failed: {StatusCode} - {Error}", response.StatusCode, err);
            return null;
        }

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var candidates = json.GetProperty("candidates");
        if (candidates.GetArrayLength() > 0)
        {
            var text = candidates[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
            return text;
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Exception calling Gemini API");
    }
    return null;
}

record ExtractTagsRequest(string Abstract);
record AnalyzeSimilarityRequest(string Abstract);
record GenerateFeedbackRequest(string Title, string Abstract, string? DocumentText, string MilestoneType);
record SuggestIdeasRequest(string Domain);
record RecommendRequest(string Title, string Abstract, List<string> Tags);
record CreatePanelRequest(string PanelName, List<string> MemberIds, string ScheduledDate, string TimeSlot, string VenueOrLink);
record AssignGroupsRequest(string PanelId, List<string> GroupIds);

record SubmissionRequest(string GroupId, string Phase, string DocumentUrl, string SubmittedByUid);

class StudentComputed
{
    public string StudentId { get; set; } = "";
    public string StudentName { get; set; } = "";
    public string StudentRollNo { get; set; } = "";
    public double PmoScore { get; set; } = 0.0;
    public double SupervisorScore { get; set; } = 0.0;
    public List<double> PanelRawScores { get; set; } = new List<double>();
    public double ExternalScore { get; set; } = 0.0;
}

// ================================================================
// DTOs (v2 evaluation)
// ================================================================
record SubmitScoreV2Request(
    string GroupId,
    string EvaluatorRole,                // PMO | SUPERVISOR | PANEL | EXTERNAL
    List<StudentEvaluationRequest> Evaluations
);

record StudentEvaluationRequest(
    string StudentId,
    string StudentName,
    string StudentRollNo,
    Dictionary<string, double> Criteria,
    string? Feedback
);
