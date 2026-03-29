# Launch WSL windows script - TWO STEP VERSION
# Step 1: Launch new bash window
# Step 2: User runs ./launch_claude.sh in that window

# Define the target directory
$targetDir = "/home/knut/projects/sdd"

Write-Host "Launching new bash window..."

# Launch a clean new WSL bash window in the target directory
Start-Process wsl -ArgumentList @("--cd", $targetDir) -WindowStyle Normal

# Play bell sound for new window
[System.Console]::Beep(200, 200)
Write-Host "New bash window launched!"
Write-Host "In the new window, type 'code .' to launch vs code"

# Small delay 
Start-Sleep -Seconds 1.5

Write-Host "Starting bash in current window..."

# Use current window for bash in target directory
[System.Console]::Beep(220, 200)
wsl --cd $targetDir

# Play bell sound for current window (this will run when returning from WSL)
[System.Console]::Beep(180, 200)
Write-Host "Bash session ended."