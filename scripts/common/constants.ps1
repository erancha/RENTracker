$originalLocation = Get-Location
try {
    Set-Location $PSScriptRoot

    $currentBranch = git rev-parse --abbrev-ref HEAD
    $isMainBranch = -not $currentBranch -or $currentBranch -eq 'main'

    $appName = ../get-app-name.ps1
    $stackNameMain = $appName
    if ($isMainBranch) {
        $stackName = $appName
    }
    else {
        $stackName = "${appName}-fb"
    }

    if (Test-Path "$PSScriptRoot/../aws-configure.ps1") {
        . "$PSScriptRoot/../aws-configure.ps1"
    }

    $appFolder = "$PSScriptRoot/../.."
    
    return @{
        isMainBranch          = $isMainBranch
        stackName             = $stackName
        stackNameMain         = $stackNameMain
        configFilePath        = "${appFolder}/frontend/src/appConfig.json"
        lastDevConfigFilePath = "${appFolder}/frontend/appConfigDev.json"
        region                = "eu-central-1" # aws configure get region
    }
}
finally {
    Set-Location $originalLocation
}