using System.Collections.Concurrent;
using System.Text.Json;
using System.Threading.Channels;
using Google.Cloud.Firestore;
using ProjectSync.Api.Models;

namespace ProjectSync.Api.Services
{
    public interface INotificationService
    {
        Task HandleEventAsync(SystemEvent sysEvent);
        ChannelReader<string> SubscribeToStream(string userId);
        void UnsubscribeFromStream(string userId);
    }

    public class NotificationService : INotificationService
    {
        private readonly FirestoreDb _firestoreDb;
        private readonly ILogger<NotificationService> _logger;
        private readonly ConcurrentDictionary<string, Channel<string>> _userChannels = new();

        public NotificationService(FirestoreDb firestoreDb, ILogger<NotificationService> logger)
        {
            _firestoreDb = firestoreDb;
            _logger = logger;
        }

        public async Task HandleEventAsync(SystemEvent sysEvent)
        {
            try
            {
                var notification = new Notification
                {
                    RecipientId = sysEvent.RecipientId,
                    SenderId = sysEvent.SenderId,
                    EventType = sysEvent.EventType,
                    Title = sysEvent.Title,
                    Message = sysEvent.Message,
                    RedirectUrl = sysEvent.RedirectUrl
                };

                // Persist to Firestore
                var collection = _firestoreDb.Collection("notifications");
                var docRef = collection.Document(notification.Id);
                await docRef.SetAsync(notification);

                // Push to live stream if user is active
                if (_userChannels.TryGetValue(sysEvent.RecipientId, out var channel))
                {
                    var payload = JsonSerializer.Serialize(notification);
                    var sseMessage = $"data: {payload}\n\n";
                    await channel.Writer.WriteAsync(sseMessage);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to handle system event and save notification.");
            }
        }

        public ChannelReader<string> SubscribeToStream(string userId)
        {
            var channel = Channel.CreateUnbounded<string>();
            _userChannels.AddOrUpdate(userId, channel, (_, existing) => channel);
            return channel.Reader;
        }

        public void UnsubscribeFromStream(string userId)
        {
            if (_userChannels.TryRemove(userId, out var channel))
            {
                channel.Writer.TryComplete();
            }
        }
    }
}
