import subprocess
import os
import webbrowser
import time

# --- Configuration ---
backend_path = r"C:\Users\Silviu\source\repos\DisciplineApp\DisciplineApp.Api"
frontend_path = r"C:\Users\Silviu\source\repos\DisciplineApp\DisciplineApp.Frontend"
frontend_url = "http://localhost:4200/"

# Path to Chrome executable (update this path if necessary)
chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

def run_backend():
    """Runs the .NET backend."""
    print("Starting .NET backend...")
    os.chdir(backend_path)
    subprocess.Popen(["dotnet", "run", "--urls", "https://localhost:7025"], shell=True)

def run_frontend():
    """Runs the Angular frontend."""
    print("Starting Angular frontend...")
    os.chdir(frontend_path)
    subprocess.Popen(["npm", "start"], shell=True)

def open_chrome(url):
    """Opens the specified URL in Google Chrome."""
    print(f"Waiting for 10 seconds before opening {url} in Chrome...")
    time.sleep(10)  # Wait for the backend and frontend to start
    webbrowser.register("chrome", None, webbrowser.BackgroundBrowser(chrome_path))
    webbrowser.get("chrome").open(url)

if __name__ == "__main__":
    run_backend()
    run_frontend()
    open_chrome(frontend_url)
    print("Projects are running. You can now close this window.")