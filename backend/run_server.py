import os
import sys
import multiprocessing

class NullWriter:
    def write(self, s):
        pass
    def flush(self):
        pass
    def isatty(self):
        return False

if sys.stdout is None:
    sys.stdout = NullWriter()
if sys.stderr is None:
    sys.stderr = NullWriter()

if __name__ == '__main__':
    multiprocessing.freeze_support()
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    if base_dir not in sys.path:
        sys.path.insert(0, base_dir)
        
    try:
        import uvicorn
        from app.main import app
        
        port = int(os.environ.get("LEAKTRACE_PORT", "8000"))
        # uvicorn.run directly with app instance and no color logging to avoid tty issues
        uvicorn.run(
            app, 
            host="127.0.0.1", 
            port=port, 
            log_level="info",
            use_colors=False
        )
    except Exception as e:
        crash_log = os.path.join(base_dir, "leaktrace_backend_crash.log")
        with open(crash_log, "a") as f:
            import traceback
            traceback.print_exc(file=f)
        sys.exit(1)
