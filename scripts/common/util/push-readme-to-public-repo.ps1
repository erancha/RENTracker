$sourceFile = ".\RENTracker-private\README.MD"
$targetFolder = ".\RENTracker" # RENTracker-public
$targetFile = "$targetFolder\README.MD"
$repositoryUrl = "https://github.com/erancha/RENTracker.git"
$commitMessage = "Add README.md via hardlink"

Set-Location ..\..\..\..

# Create a new subfolder 'RENTracker'
New-Item -ItemType Directory -Path $targetFolder -Force

# Create a hardlink from the target folder to the source README.md
Write-Host "cmd /c mklink /H $targetFile $sourceFile"
if (Test-Path $targetFile) {
   Remove-Item $targetFile -Force
}
cmd /c mklink /H $targetFile $sourceFile

# Navigate to the 'RENTracker' directory
Set-Location -Path $targetFolder

git init
git add README.MD
git commit -m $commitMessage
git branch -M main
git remote add origin $repositoryUrl
git push -u origin main

Set-Location ..\RENTracker-private\scripts\common\util\