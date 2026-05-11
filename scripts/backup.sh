#!/bin/bash
# backup.sh - 数据库备份脚本

set -e

# 配置
BACKUP_DIR="/backups"
DB_NAME="xiexiaoshuo"
DB_USER="postgres"
DB_HOST="db"
RETENTION_DAYS=7
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/xiexiaoshuopro_${DATE}.sql.gz"

# 创建备份目录
mkdir -p "${BACKUP_DIR}"

# 执行备份
echo "Starting backup at ${DATE}..."
pg_dump -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" | gzip > "${BACKUP_FILE}"

# 验证备份
if [ -f "${BACKUP_FILE}" ]; then
    echo "Backup completed: ${BACKUP_FILE}"
    ls -lh "${BACKUP_FILE}"
else
    echo "Backup failed!"
    exit 1
fi

# 清理旧备份
echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "xiexiaoshuopro_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

# 列出剩余备份
echo "Remaining backups:"
ls -lh "${BACKUP_DIR}"

echo "Backup process completed successfully!"
