import asyncio
import time
import json
import logging
from collections import deque
from typing import Dict, Any, List, Set, AsyncGenerator

logger = logging.getLogger("leaktrace.events")

class EventBroker:
    """
    Lightweight, high-performance in-memory Realtime Event Broker.
    Powers Server-Sent Events (SSE) and short-interval polling fallback for connected dashboards.
    """
    def __init__(self, max_history: int = 500):
        self.subscribers: Set[asyncio.Queue] = set()
        self.history: deque = deque(maxlen=max_history)
        try:
            _ = asyncio.get_running_loop()
            self._lock = asyncio.Lock()
        except RuntimeError:
            self._lock = None

    def publish(self, event_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Publishes an event to all connected SSE clients and stores in event history.
        Safe to call from synchronous route handlers.
        """
        event = {
            "event_type": event_type,
            "data": data,
            "timestamp": time.time()
        }
        self.history.append(event)
        
        # Dispatch to active SSE subscriber queues
        dead_queues = set()
        for q in list(self.subscribers):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                dead_queues.add(q)
            except Exception:
                dead_queues.add(q)

        for dq in dead_queues:
            self.subscribers.discard(dq)

        logger.info(f"[Realtime Event] Published {event_type} to {len(self.subscribers)} listeners.")
        return event

    async def subscribe(self) -> AsyncGenerator[str, None]:
        """
        Asynchronous generator for Server-Sent Events (SSE).
        Yields text/event-stream formatted messages.
        """
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self.subscribers.add(queue)
        
        try:
            # Yield initial connection confirmation
            init_event = {
                "event_type": "CONNECTED",
                "data": {"status": "ENCLAVE_REALTIME_STREAM_ACTIVE", "subscribers": len(self.subscribers)},
                "timestamp": time.time()
            }
            yield f"event: {init_event['event_type']}\ndata: {json.dumps(init_event)}\n\n"

            while True:
                # Wait for next event with a periodic heartbeat ping every 15 seconds
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"event: {event['event_type']}\ndata: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    # Send keep-alive ping for proxies and Render cold prevention
                    yield f": keepalive {time.time()}\n\n"
        finally:
            self.subscribers.discard(queue)

    def get_recent_events(self, since: float = 0.0) -> List[Dict[str, Any]]:
        """
        Returns events occurring after `since` timestamp for polling fallback.
        """
        return [e for e in self.history if e["timestamp"] > since]


# Global singleton instance
event_broker = EventBroker()
