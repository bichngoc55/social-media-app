# Script to import data from cloud database to local loopydb
# Usage: .\scripts\import-from-cloud.ps1

param(
    [Parameter(Mandatory=$true)]
    [string]$CloudDatabaseUrl,
    
    [Parameter(Mandatory=$false)]
    [string]$LocalDatabaseUrl = "postgresql://loopy:loopy@localhost:5433/loopydb?schema=public"
)

Write-Host "🔄 Importing data from cloud to local database..." -ForegroundColor Cyan

# Parse connection strings
function Parse-PostgresUrl {
    param([string]$url)
    $pattern = "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)"
    if ($url -match $pattern) {
        return @{
            User = $matches[1]
            Password = $matches[2]
            Host = $matches[3]
            Port = $matches[4]
            Database = $matches[5]
        }
    }
    throw "Invalid PostgreSQL URL format"
}

try {
    $cloud = Parse-PostgresUrl $CloudDatabaseUrl
    $local = Parse-PostgresUrl $LocalDatabaseUrl
    
    Write-Host "📥 Dumping data from cloud database..." -ForegroundColor Yellow
    Write-Host "   Cloud: $($cloud.Host):$($cloud.Port)/$($cloud.Database)" -ForegroundColor Gray
    
    # Set PGPASSWORD environment variable for pg_dump
    $env:PGPASSWORD = $cloud.Password
    
    # Dump data only (no schema, as we already have schema)
    $dumpFile = "cloud-dump-$(Get-Date -Format 'yyyyMMdd-HHmmss').sql"
    
    # Dump only data (INSERT statements)
    & pg_dump `
        -h $cloud.Host `
        -p $cloud.Port `
        -U $cloud.User `
        -d $cloud.Database `
        --data-only `
        --column-inserts `
        --no-owner `
        --no-privileges `
        -f $dumpFile
    
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to dump data from cloud database"
    }
    
    Write-Host "✅ Data dumped successfully to $dumpFile" -ForegroundColor Green
    Write-Host "📤 Importing data to local database..." -ForegroundColor Yellow
    Write-Host "   Local: $($local.Host):$($local.Port)/$($local.Database)" -ForegroundColor Gray
    
    # Set PGPASSWORD for local database
    $env:PGPASSWORD = $local.Password
    
    # Import data to local database
    & psql `
        -h $local.Host `
        -p $local.Port `
        -U $local.User `
        -d $local.Database `
        -f $dumpFile
    
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to import data to local database"
    }
    
    Write-Host "✅ Data imported successfully!" -ForegroundColor Green
    Write-Host "📊 Verifying data..." -ForegroundColor Yellow
    
    # Check record counts
    $tables = @("users", "posts", "comments", "likes", "bookmarks", "notifications")
    foreach ($table in $tables) {
        $count = & psql -h $local.Host -p $local.Port -U $local.User -d $local.Database -t -c "SELECT COUNT(*) FROM $table;"
        Write-Host "   $table`: $($count.Trim()) records" -ForegroundColor Gray
    }
    
    Write-Host "`n🎉 Import completed successfully!" -ForegroundColor Green
    Write-Host "💾 Dump file saved as: $dumpFile" -ForegroundColor Cyan
    Write-Host "   (You can delete it if you don't need it anymore)" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
} finally {
    # Clear password from environment
    $env:PGPASSWORD = $null
}


# Usage: .\scripts\import-from-cloud.ps1

param(
    [Parameter(Mandatory=$true)]
    [string]$CloudDatabaseUrl,
    
    [Parameter(Mandatory=$false)]
    [string]$LocalDatabaseUrl = "postgresql://loopy:loopy@localhost:5433/loopydb?schema=public"
)

Write-Host "🔄 Importing data from cloud to local database..." -ForegroundColor Cyan

# Parse connection strings
function Parse-PostgresUrl {
    param([string]$url)
    $pattern = "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)"
    if ($url -match $pattern) {
        return @{
            User = $matches[1]
            Password = $matches[2]
            Host = $matches[3]
            Port = $matches[4]
            Database = $matches[5]
        }
    }
    throw "Invalid PostgreSQL URL format"
}

try {
    $cloud = Parse-PostgresUrl $CloudDatabaseUrl
    $local = Parse-PostgresUrl $LocalDatabaseUrl
    
    Write-Host "📥 Dumping data from cloud database..." -ForegroundColor Yellow
    Write-Host "   Cloud: $($cloud.Host):$($cloud.Port)/$($cloud.Database)" -ForegroundColor Gray
    
    # Set PGPASSWORD environment variable for pg_dump
    $env:PGPASSWORD = $cloud.Password
    
    # Dump data only (no schema, as we already have schema)
    $dumpFile = "cloud-dump-$(Get-Date -Format 'yyyyMMdd-HHmmss').sql"
    
    # Dump only data (INSERT statements)
    & pg_dump `
        -h $cloud.Host `
        -p $cloud.Port `
        -U $cloud.User `
        -d $cloud.Database `
        --data-only `
        --column-inserts `
        --no-owner `
        --no-privileges `
        -f $dumpFile
    
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to dump data from cloud database"
    }
    
    Write-Host "✅ Data dumped successfully to $dumpFile" -ForegroundColor Green
    Write-Host "📤 Importing data to local database..." -ForegroundColor Yellow
    Write-Host "   Local: $($local.Host):$($local.Port)/$($local.Database)" -ForegroundColor Gray
    
    # Set PGPASSWORD for local database
    $env:PGPASSWORD = $local.Password
    
    # Import data to local database
    & psql `
        -h $local.Host `
        -p $local.Port `
        -U $local.User `
        -d $local.Database `
        -f $dumpFile
    
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to import data to local database"
    }
    
    Write-Host "✅ Data imported successfully!" -ForegroundColor Green
    Write-Host "📊 Verifying data..." -ForegroundColor Yellow
    
    # Check record counts
    $tables = @("users", "posts", "comments", "likes", "bookmarks", "notifications")
    foreach ($table in $tables) {
        $count = & psql -h $local.Host -p $local.Port -U $local.User -d $local.Database -t -c "SELECT COUNT(*) FROM $table;"
        Write-Host "   $table`: $($count.Trim()) records" -ForegroundColor Gray
    }
    
    Write-Host "`n🎉 Import completed successfully!" -ForegroundColor Green
    Write-Host "💾 Dump file saved as: $dumpFile" -ForegroundColor Cyan
    Write-Host "   (You can delete it if you don't need it anymore)" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
} finally {
    # Clear password from environment
    $env:PGPASSWORD = $null
}

