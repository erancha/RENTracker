$originalLocation = Get-Location
try {
    Set-Location $PSScriptRoot

    $currentBranch = git rev-parse --abbrev-ref HEAD
    $isMainBranch = -not $currentBranch -or $currentBranch -eq 'main'

    $appName = ../get-app-name.ps1
    $stackNameMain = $appName
    if ($isMainBranch) {
        $stackName = $appName

        # Get tenant information from environment or use defaults
        $SaaSTenantUserId = $env:SAAS_TENANT_USER_ID
        $SaaSTenantShortName = $env:SAAS_TENANT_SHORT_NAME
        if ($SaaSTenantUserId) {
            if (-not $SaaSTenantShortName) {
                $SaaSTenantShortName = $SaaSTenantUserId
            }
            $stackName = "$stackName-$SaaSTenantShortName"
        }
    }
    else {
        $stackName = "${appName}-f"
    }

    $appFolder = "$PSScriptRoot/../.."
    
    return @{
        isMainBranch          = $isMainBranch
        stackName             = $stackName
        stackNameMain         = $stackNameMain
        SaaSTenantUserId      = $SaaSTenantUserId
        SaaSTenantShortName   = $SaaSTenantShortName
        configFilePath        = "${appFolder}/frontend/src/appConfig.json"
        lastDevConfigFilePath = "${appFolder}/frontend/appConfigDev.json"
        region                = "eu-central-1" # aws configure get region
    }
}
finally {
    Set-Location $originalLocation
}