using System.Collections.Concurrent;
using System.Threading.Channels;

namespace ProjectSync.Api.Services
{
    public interface IEventDispatcher
    {
        void Dispatch<T>(T @event) where T : class;
        void Subscribe<T>(Action<T> handler) where T : class;
    }

    public class EventDispatcher : IEventDispatcher
    {
        private readonly ConcurrentDictionary<Type, List<Delegate>> _subscribers = new();

        public void Subscribe<T>(Action<T> handler) where T : class
        {
            var eventType = typeof(T);
            var delegates = _subscribers.GetOrAdd(eventType, _ => new List<Delegate>());
            lock (delegates)
            {
                delegates.Add(handler);
            }
        }

        public void Dispatch<T>(T @event) where T : class
        {
            var eventType = typeof(T);
            if (_subscribers.TryGetValue(eventType, out var delegates))
            {
                List<Delegate> delegatesSnapshot;
                lock (delegates)
                {
                    delegatesSnapshot = delegates.ToList();
                }

                foreach (var del in delegatesSnapshot)
                {
                    if (del is Action<T> handler)
                    {
                        Task.Run(() => handler(@event));
                    }
                }
            }
        }
    }
}
