#!/bin/bash
# restore.sh - 数据库恢复脚本

set -e

# 配置
DB_NAME="xiexiaoshuo"
DB_USER="postgres"
DB_HOST="db"

# 检查参数
if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file>"
    echo "Available backups:"
    ls -lh /backups/*.sql.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Error: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# 确认恢复
echo "WARNING: This will overwrite the current database!"
echo "Backup file: ${BACKUP_FILE}"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# 执行恢复
echo "Starting restore from ${BACKUP_FILE}..."

echo "Dropping existing database..."
dropdb -h "${DB_HOST}" -U "${DB_USER}" --if-exists "${DB_NAME}"

echo "Creating new database..."
createdb -h "${DB_HOST}" -U "${DB_USER}" "${DB_NAME}"

echo "Restoring data..."
gunzip < "${BACKUP_FILE}" | psql -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}"

echo "Restore completed successfully!"
