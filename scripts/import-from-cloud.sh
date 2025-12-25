#!/bin/bash
# Script to import data from cloud database to local loopydb
# Usage: ./scripts/import-from-cloud.sh <CLOUD_DATABASE_URL>

if [ -z "$1" ]; then
    echo "❌ Error: Cloud database URL is required"
    echo "Usage: ./scripts/import-from-cloud.sh <CLOUD_DATABASE_URL>"
    exit 1
fi

CLOUD_DB_URL="$1"
LOCAL_DB_URL="${2:-postgresql://loopy:loopy@localhost:5433/loopydb?schema=public}"

echo "🔄 Importing data from cloud to local database..."

# Parse PostgreSQL URL
parse_url() {
    local url="$1"
    if [[ $url =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]+) ]]; then
        export PGUSER="${BASH_REMATCH[1]}"
        export PGPASSWORD="${BASH_REMATCH[2]}"
        export PGHOST="${BASH_REMATCH[3]}"
        export PGPORT="${BASH_REMATCH[4]}"
        export PGDATABASE="${BASH_REMATCH[5]}"
    else
        echo "❌ Invalid PostgreSQL URL format"
        exit 1
    fi
}

# Dump from cloud
echo "📥 Dumping data from cloud database..."
parse_url "$CLOUD_DB_URL"
DUMP_FILE="cloud-dump-$(date +%Y%m%d-%H%M%S).sql"

pg_dump \
    --data-only \
    --column-inserts \
    --no-owner \
    --no-privileges \
    -f "$DUMP_FILE"

if [ $? -ne 0 ]; then
    echo "❌ Failed to dump data from cloud database"
    exit 1
fi

echo "✅ Data dumped successfully to $DUMP_FILE"

# Import to local
echo "📤 Importing data to local database..."
parse_url "$LOCAL_DB_URL"

psql -f "$DUMP_FILE"

if [ $? -ne 0 ]; then
    echo "❌ Failed to import data to local database"
    exit 1
fi

echo "✅ Data imported successfully!"

# Verify
echo "📊 Verifying data..."
TABLES=("users" "posts" "comments" "likes" "bookmarks" "notifications")
for table in "${TABLES[@]}"; do
    COUNT=$(psql -t -c "SELECT COUNT(*) FROM $table;")
    echo "   $table: $COUNT records"
done

echo ""
echo "🎉 Import completed successfully!"
echo "💾 Dump file saved as: $DUMP_FILE"
echo "   (You can delete it if you don't need it anymore)"


# Script to import data from cloud database to local loopydb
# Usage: ./scripts/import-from-cloud.sh <CLOUD_DATABASE_URL>

if [ -z "$1" ]; then
    echo "❌ Error: Cloud database URL is required"
    echo "Usage: ./scripts/import-from-cloud.sh <CLOUD_DATABASE_URL>"
    exit 1
fi

CLOUD_DB_URL="$1"
LOCAL_DB_URL="${2:-postgresql://loopy:loopy@localhost:5433/loopydb?schema=public}"

echo "🔄 Importing data from cloud to local database..."

# Parse PostgreSQL URL
parse_url() {
    local url="$1"
    if [[ $url =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]+) ]]; then
        export PGUSER="${BASH_REMATCH[1]}"
        export PGPASSWORD="${BASH_REMATCH[2]}"
        export PGHOST="${BASH_REMATCH[3]}"
        export PGPORT="${BASH_REMATCH[4]}"
        export PGDATABASE="${BASH_REMATCH[5]}"
    else
        echo "❌ Invalid PostgreSQL URL format"
        exit 1
    fi
}

# Dump from cloud
echo "📥 Dumping data from cloud database..."
parse_url "$CLOUD_DB_URL"
DUMP_FILE="cloud-dump-$(date +%Y%m%d-%H%M%S).sql"

pg_dump \
    --data-only \
    --column-inserts \
    --no-owner \
    --no-privileges \
    -f "$DUMP_FILE"

if [ $? -ne 0 ]; then
    echo "❌ Failed to dump data from cloud database"
    exit 1
fi

echo "✅ Data dumped successfully to $DUMP_FILE"

# Import to local
echo "📤 Importing data to local database..."
parse_url "$LOCAL_DB_URL"

psql -f "$DUMP_FILE"

if [ $? -ne 0 ]; then
    echo "❌ Failed to import data to local database"
    exit 1
fi

echo "✅ Data imported successfully!"

# Verify
echo "📊 Verifying data..."
TABLES=("users" "posts" "comments" "likes" "bookmarks" "notifications")
for table in "${TABLES[@]}"; do
    COUNT=$(psql -t -c "SELECT COUNT(*) FROM $table;")
    echo "   $table: $COUNT records"
done

echo ""
echo "🎉 Import completed successfully!"
echo "💾 Dump file saved as: $DUMP_FILE"
echo "   (You can delete it if you don't need it anymore)"


