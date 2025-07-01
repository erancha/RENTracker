param (
    [bool]$skipBuildDeploy,
    [bool]$syncLambdas, # if true - only sync lambda functions
    [bool]$deleteStack,
    [bool]$deployFrontend
)

$scriptName = Split-Path -Leaf $PSCommandPath

$commonConstants = ./constants.ps1

. ./util/get-ElapsedTimeFormatted.ps1
$startTime = Get-Date
$formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : $scriptName ..." -ForegroundColor White -BackgroundColor DarkBlue

if (-not $skipBuildDeploy) {
    if ($syncLambdas) {
        Set-Variable -Name 'TEMPLATE_FILE' -Value "../template.yaml" -Option Constant 

        Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Syncing Lambda functions .."
        sam sync --region $commonConstants.region --template-file $TEMPLATE_FILE --stack-name $commonConstants.stackName
        $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Lambda functions synced successfully." -ForegroundColor Green
        }
        else {
            Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Lambda sync failed with exit code ${LASTEXITCODE}."
        }
    } 
    else {
        Push-Location ..
        ./dev-build-deploy.ps1 -prepareForFrontend $deployFrontend
        Pop-Location
    }
}

if ($deleteStack) {
    # $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
    # Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Detaching MyAppSG from elasticache's and RDS' SGs ..."
    # ./remove-sg-from-sg.ps1 -mySGName "MyAppSG" -targetSGId 'sg-0c5868829116d3628' -port 6379 # TODO: --> constants.ps1 : $elasticacheSGId
    # ./remove-sg-from-sg.ps1 -mySGName "MyAppSG" -targetSGId 'sg-0280f7af5f31cb24d' -port 5432 # TODO: --> constants.ps1 : $rdsSGId

    $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
    Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Deleting stack '$($commonConstants.stackName)' ..."

    aws cloudformation delete-stack --stack-name $commonConstants.stackName --region $commonConstants.region
    aws cloudformation wait stack-delete-complete --stack-name $commonConstants.stackName --region $commonConstants.region

    $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
    Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Deleting log groups and streams for stack '$($commonConstants.stackName)' ..."

    Push-Location util
    ./manage-log-groups.ps1 -deleteLogGroupsSuffix $commonConstants.stackName
    Pop-Location
}

if ($deployFrontend) {
    ./deploy-frontend-distribution.ps1
}
elseif (-not $deleteStack) {
    ./update-app-config-dev.ps1
}

Push-Location util
./manage-log-groups.ps1 -deleteLogStreamsSuffix $commonConstants.stackName
./manage-log-groups.ps1 -manageRetentionLogGroupsSuffix $commonConstants.stackName
# ./list-all-non-default-resources.ps1 -region $commonConstants.region | Select-String -Pattern "$($commonConstants.stackName)-|$($commonConstants.stackNameMain)-"
Pop-Location

$formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Completed $scriptName." -ForegroundColor Blue