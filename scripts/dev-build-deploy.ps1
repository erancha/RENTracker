param (
    [bool]$prepareForFrontend
)

Push-Location $PSScriptRoot
try {
    $scriptName = Split-Path -Leaf $PSCommandPath

    . ./common/util/get-ElapsedTimeFormatted.ps1
    $startTime = Get-Date
    $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
    Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : $scriptName ..." -ForegroundColor White -BackgroundColor DarkBlue

    $commonConstants = ./common/constants.ps1
    Set-Variable -Name 'TEMPLATE_FILE' -Value "$PSScriptRoot/template.yaml" -Option Constant 

    $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
    Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Validating the cloudformation template .."
    sam validate --region $commonConstants.region --template-file $TEMPLATE_FILE --lint # | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() }
    if ($LASTEXITCODE -eq 0) {
        $skipFixedLambdaLayers = $true
        $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
        if ($skipFixedLambdaLayers) {
            Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Skipping lambda layers !" -ForegroundColor Yellow -BackgroundColor DarkGreen
        }
        else {
            Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Preparing lambda layers .."
            $appFolder = (Split-Path $PSScriptRoot -Parent)
            $folderBeforeLayers = Get-Location

            Push-Location "${appFolder}/backend/layers/awssdkv3/nodejs/"
            npm install
            Set-Location ..
            Compress-Archive -Update -Path nodejs/* -DestinationPath ../awssdkv3-layer.zip
            Pop-Location

            Push-Location "${appFolder}/backend/layers/document-utils/"
            npm install
            Pop-Location

            Push-Location "${appFolder}/backend/RenTracker-service/ecs/layers/dbData/"
            npm install
            Pop-Location

            Push-Location "${appFolder}/backend/RenTracker-service/ecs/layers/redisClient/"
            npm install
            Pop-Location

            Set-Location $folderBeforeLayers
        }

        $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
        Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : sam build --template-file $TEMPLATE_FILE ..`n"
        sam build --region $commonConstants.region --template-file $TEMPLATE_FILE # > $null
        if ($LASTEXITCODE -eq 0) {
            $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
            Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Build completed. Deploying .."

            # Build the parameter overrides string dynamically
            $parameterOverrides = @(
                "ExistingVpcId='vpc-08016eb77e7ac9962'", # en-VPC
                "ExistingUserPoolId='eu-central-1_OHq1aZYju'", # en-UserPool
                "ExistingCognitoDomain='ena-575491442067.auth.eu-central-1.amazoncognito.com'",
                "ExistingAppPrivateSubnetId='subnet-0fae544467955a871'", # crud-WebsocketsPrivateSubnet1
                "ExistingAppSG='sg-0263cec5751eb503a'", # crud-WebSocketLambda-SG
                "ExistingElasticacheRedisClusterAddress='en-elasticache-redis-cluster.hz2zez.0001.euc1.cache.amazonaws.com:6379'", # https://eu-central-1.console.aws.amazon.com/cognito/v2/idp/user-pools/eu-central-1_OHq1aZYju/branding/domain?region=eu-central-1
                "TargetChattyLambdaArn='arn:aws:lambda:eu-central-1:575491442067:function:cht-GenericWebsocketReceiverFunction-OWfDNLjFGPdu'"
                # "DisableAppCache='true'",
                # "ExistingRDSEndpoint='crud-rds.ctqgw46o4gm3.eu-central-1.rds.amazonaws.com'", # crud-rds
                # "ExistingRDSSecurityGroupId='sg-0280f7af5f31cb24d'", # crud-RDSSG
                # "DeveloperIP='149.106.249.221/32'"
            )

            if ($commonConstants.isMainBranch) {
                $parameterOverrides += "StageName='prod'"
            }
            else {
                # $parameterOverrides += "EnableAdditionalMetrics='true'" # TODO: In actual production, these metrics will be more relevant than during development ..
            }

            # Join the parameter overrides into a single string
            $parameterOverridesString = $parameterOverrides -join " "

            $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
            Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Starting a deployment, stack '$($commonConstants.stackName)' .."
            # CAPABILITY_IAM: This capability allows AWS CloudFormation to create IAM resources (such as roles and policies) on your behalf
            sam deploy --region $commonConstants.region --template-file $TEMPLATE_FILE --stack-name $commonConstants.stackName `
                --capabilities CAPABILITY_IAM `
                --fail-on-empty-changeset false `
                --resolve-s3 `
                --parameter-overrides $parameterOverridesString
            $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
            if (($LASTEXITCODE -ne 0) -and ($LASTEXITCODE -ne 1)) {
                Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Deployment failed with exit code ${LASTEXITCODE}."
            }
            else {
                if ($LASTEXITCODE -eq 1) {
                    Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Deployment completed with no changes to deploy. Stack '$($commonConstants.stackName)' is up to date."
                }
                else {
                    Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Deployment completed successfully." -ForegroundColor Green

                    # $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
                    # Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Attaching MyAppSG to elasticache's and RDS' SGs ..."
                    # Push-Location common
                    # ./add-sg-to-sg.ps1 -mySGName "MyAppSG" -targetSGId 'sg-0c5868829116d3628' -port 6379 # TODO: --> constants.ps1 : $elasticacheSGId
                    # ./add-sg-to-sg.ps1 -mySGName "MyAppSG" -targetSGId 'sg-0280f7af5f31cb24d' -port 5432 # TODO: --> constants.ps1 : $rdsSGId
                    # Pop-Location
                }

                if ($prepareForFrontend) {
                    ./common/update-app-config-dev.ps1
                }
            }
        }
        else {
            $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
            Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : SAM build failed."
        }
    }

    $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
    Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Completed $scriptName." -ForegroundColor Blue
}
finally {
    Pop-Location
}