using System.Text.Json.Serialization;

namespace ProjectSync.Api.Models
{
    public class Notification
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        [JsonPropertyName("recipientId")]
        public string RecipientId { get; set; } = string.Empty;

        [JsonPropertyName("senderId")]
        public string? SenderId { get; set; }

        [JsonPropertyName("eventType")]
        public string EventType { get; set; } = string.Empty;

        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("message")]
        public string Message { get; set; } = string.Empty;

        [JsonPropertyName("redirectUrl")]
        public string RedirectUrl { get; set; } = string.Empty;

        [JsonPropertyName("isRead")]
        public bool IsRead { get; set; } = false;

        [JsonPropertyName("createdAt")]
        public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("O");
    }

    public class SystemEvent
    {
        public string EventType { get; set; } = string.Empty;
        public string RecipientId { get; set; } = string.Empty;
        public string? SenderId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string RedirectUrl { get; set; } = string.Empty;
    }
}
