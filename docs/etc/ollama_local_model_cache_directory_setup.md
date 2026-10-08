# Ollama Local Model Cache Directory Setup

To change the Ollama model cache directory in WSL (Windows Subsystem for Linux), set the OLLAMA_MODELS environment variable to your desired path. [1] 
By default, Ollama stores models in ~/.ollama/models when run as a regular user, or in /usr/share/ollama/.ollama/models if installed as a Linux systemd service. [1] 
------------------------------
## Step 1: Stop the Ollama Service
If Ollama is currently running in your WSL shell or as a service, stop it first:

# If running manually in the terminal, press Ctrl + C or run:
pkill ollama
# If running as a systemd service:
sudo systemctl stop ollama

------------------------------
## Step 2: Set the OLLAMA_MODELS Environment Variable
How you configure the variable depends on how you run Ollama in WSL:
## Option A: Running Ollama manually (User mode)
Add OLLAMA_MODELS to your shell profile so it is set every time you open Bash:

# Open or create your ~/.bashrc (or ~/.zshrc if using zsh)
echo 'export OLLAMA_MODELS="/path/to/your/new/models"' >> ~/.bashrc
# Apply the change immediately
source ~/.bashrc

## Option B: Running Ollama via Systemd
If Ollama was installed via the script and runs as a systemd service, you must configure the environment variable inside the systemd service override file: [2] 

   1. Edit the service configuration using systemctl:
   
   sudo systemctl edit ollama.service
   
   2. Add the Environment line under the [Service] block:
   
   [Service]
   Environment="OLLAMA_MODELS=/path/to/your/new/models"
   
   3. Save and close the editor (if using nano, press Ctrl + O, Enter, then Ctrl + X).
   4. Reload systemd and restart the service: [2] 
   
   sudo systemctl daemon-reload
   sudo systemctl restart ollama
   
   
------------------------------
## Step 3: Set Permissions (If using Systemd)
If Ollama runs under a dedicated ollama user account, give that user ownership and write permissions over your new directory: [2] 

sudo mkdir -p /path/to/your/new/models
sudo chown -R ollama:ollama /path/to/your/new/models

------------------------------
## Step 4: Move Existing Models (Optional)
If you already downloaded models to the old directory, move the contents manually to your new folder so you do not have to re-download them: [1] 

cp -r ~/.ollama/models/* /path/to/your/new/models/# Or if moving from system path:# sudo cp -r /usr/share/ollama/.ollama/models/* /path/to/your/new/models/

If you'd like, let me know:

* How you installed Ollama (via curl script or Docker)
* Where you want to store the models (inside the WSL ext4 virtual disk or on a Windows /mnt/c/... drive)

I can give you the exact commands for your setup.

[1] [https://dasarpai.com](https://dasarpai.com/dsblog/exploring-ollama-models-location-on-wsl2/)
[2] [https://www.reddit.com](https://www.reddit.com/r/ollama/comments/1c4zg15/does_anyone_know_how_to_change_where_your_models/)
