import sys
import os

def main():
    try:
        from gui_app import MeditationVideoApp
    except ImportError as e:
        print(f"Missing dependency: {e}")
        print("Run: pip install -r requirements.txt")
        sys.exit(1)

    app = MeditationVideoApp()
    app.mainloop()

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    main()
