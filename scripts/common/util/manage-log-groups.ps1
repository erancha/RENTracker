param (
    [string]$deleteLogGroupsSuffix = "",
    [string]$deleteLogStreamsSuffix = "",
    [string]$manageRetentionLogGroupsSuffix = ""
)

. ./get-ElapsedTimeFormatted.ps1
$startTime = Get-Date

$scriptName = Split-Path -Leaf $PSCommandPath
$commonConstants = . ../constants.ps1
$formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime

# Log non-empty parameters
$params = @{}
if ($deleteLogGroupsSuffix -ne "") { $params.Add("deleteLogGroupsSuffix", $deleteLogGroupsSuffix) }
if ($deleteLogStreamsSuffix -ne "") { $params.Add("deleteLogStreamsSuffix", $deleteLogStreamsSuffix) }
if ($manageRetentionLogGroupsSuffix -ne "") { $params.Add("manageRetentionLogGroupsSuffix", $manageRetentionLogGroupsSuffix) }
$paramsString = if ($params.Count -gt 0) { " with params: " + ($params.GetEnumerator() | ForEach-Object { "$($_.Key)='$($_.Value)'" }) -join ", " } else { "" }
Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : $scriptName --region $($commonConstants.region) $paramsString ..." -ForegroundColor White -BackgroundColor DarkBlue

# Get the list of all existing log groups, ensuring output is trimmed and split correctly
$logGroups = aws logs --region $commonConstants.region describe-log-groups --query 'logGroups[*].logGroupName' --output text | Out-String | ForEach-Object { $_.Trim() }
$logGroupsArray = $logGroups -split '\s+' | Where-Object { $_ -ne '' }

if ($deleteLogGroupsSuffix -ne "") {
    $filteredLogGroups = $logGroupsArray | Where-Object { $_.EndsWith($deleteLogGroupsSuffix) }
    foreach ($logGroup in $filteredLogGroups) {
        Write-Host "Deleting log group: $logGroup"
        aws logs --region $commonConstants.region delete-log-group --log-group-name $logGroup | Out-Null
    }
}
elseif ($deleteLogStreamsSuffix -ne "") {
    # Filter log groups that start with the specified prefix
    $filteredLogGroups = $logGroupsArray | Where-Object { $_.EndsWith($deleteLogStreamsSuffix) }
    
    foreach ($logGroup in $filteredLogGroups) {
        try {
            $streamCounter = 1
            $nextToken = $null
            
            do {
                # Get batch of log streams (maximum 250 at a time)
                $describeCommand = "aws logs --region $($commonConstants.region) describe-log-streams --log-group-name `"$logGroup`" --max-items 250 --query 'logStreams[*].logStreamName' --output json"
                if ($nextToken) {
                    $describeCommand += " --starting-token $nextToken"
                }
                
                $logStreamsJson = Invoke-Expression $describeCommand
                
                if ($logStreamsJson) {
                    $logStreamsObj = $logStreamsJson | ConvertFrom-Json
                    if ($logStreamsObj) {
                        foreach ($logStream in $logStreamsObj) {
                            try {
                                Write-Host "Deleting stream #${streamCounter}: $logStream from $logGroup"
                                aws logs --region $commonConstants.region delete-log-stream --log-group-name $logGroup --log-stream-name $logStream | Out-Null
                                $streamCounter++
                            }
                            catch {
                                Write-Warning "Failed to delete stream $logStream : $_"
                            }
                        }
                    }
                }
                
                # Get next token
                $nextTokenCommand = "aws logs --region $($commonConstants.region) describe-log-streams --log-group-name `"$logGroup`" --max-items 250 --query 'nextToken' --output text"
                $nextTokenResult = Invoke-Expression $nextTokenCommand
                $nextToken = if ($nextTokenResult -eq "None") { $null } else { $nextTokenResult }
            } while ($nextToken)

            $formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
            Write-Host "$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Completed processing $logGroup.`n"
        }
        catch {
            Write-Warning "Error processing log group $logGroup : $_"
            continue
        }
    }
}
elseif ($manageRetentionLogGroupsSuffix -ne "") {
    $filteredLogGroups = $logGroupsArray | Where-Object { $_.EndsWith($manageRetentionLogGroupsSuffix) }
    foreach ($logGroup in $filteredLogGroups) {
        # Check if log group name length is valid
        if ($logGroup.Length -le 512) {
            Write-Host "Setting retention policy for log group: $logGroup"
            aws logs --region $commonConstants.region put-retention-policy --log-group-name $logGroup --retention-in-days 1 | Out-Null
        }
        else {
            Write-Host "Skipped log group due to invalid name length: $logGroup"
        }
    }
}
else {
    # Set retention policy:
    foreach ($logGroup in $logGroupsArray) {
        # Check if log group name length is valid
        if ($logGroup.Length -le 512) {
            Write-Host "Setting retention policy for log group: $logGroup"
            aws logs --region $commonConstants.region put-retention-policy --log-group-name $logGroup --retention-in-days 1 | Out-Null
        }
        else {
            Write-Host "Skipped log group due to invalid name length: $logGroup"
        }
    }
}

$formattedElapsedTime = Get-ElapsedTimeFormatted -startTime $startTime
Write-Host "`n$(Get-Date -Format 'HH:mm:ss'), elapsed $formattedElapsedTime : Completed."
