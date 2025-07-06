param(
    [Parameter(Mandatory=$true)][string]$mySGName,
    [Parameter(Mandatory=$true)][string]$targetSGId,
    [Parameter(Mandatory=$true)][int]$port,
    [Parameter(Mandatory=$false)]$stackOutputs
)

$commonConstants = ./constants.ps1
if (-not $stackOutputs) {
    $stackOutputs = ./util/get-stack-outputs.ps1
}
$mySGId = ($stackOutputs | Where-Object { $_.OutputKey -eq $mySGName }).OutputValue
if (-not $mySGId) {
    Write-Error "$mySGName not found in stack outputs."
    exit
}
aws ec2 authorize-security-group-ingress --group-id $targetSGId --protocol tcp --port $port --source-group $mySGId --region $commonConstants.region
