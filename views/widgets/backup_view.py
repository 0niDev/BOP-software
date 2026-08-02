"""Backup management widget."""
from __future__ import annotations

from PySide6.QtCore import Qt, QTimer
from PySide6.QtWidgets import (
    QHBoxLayout,
    QLabel,
    QMessageBox,
    QPushButton,
    QVBoxLayout,
    QWidget,
    QTableWidget,
    QTableWidgetItem,
    QFileDialog,
    QGroupBox,
)

from controllers.backup_controller import BackupController
from utils.logger import get_logger

logger = get_logger(__name__)


class BackupView(QWidget):
    """Widget for managing backups."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.controller = BackupController()
        self._build_ui()
        self._load_backup_status()

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(15)

        # Title
        title = QLabel("💾 Backup Management")
        title.setStyleSheet("font-size: 18px; font-weight: bold;")
        layout.addWidget(title)

        # Backup locations
        locations_group = QGroupBox("📁 Backup Locations")
        locations_layout = QVBoxLayout(locations_group)
        
        self.locations_text = QLabel("Loading backup locations...")
        self.locations_text.setWordWrap(True)
        self.locations_text.setStyleSheet("padding: 10px; background: #f8f9fa; border-radius: 4px;")
        locations_layout.addWidget(self.locations_text)
        
        layout.addWidget(locations_group)

        # Action buttons
        buttons_layout = QHBoxLayout()
        
        backup_all_btn = QPushButton("💾 Backup All Locations")
        backup_all_btn.clicked.connect(self._backup_all)
        backup_all_btn.setMinimumHeight(40)
        buttons_layout.addWidget(backup_all_btn)
        
        backup_local_btn = QPushButton("📁 Backup Local Only")
        backup_local_btn.clicked.connect(self._backup_local)
        backup_local_btn.setMinimumHeight(40)
        buttons_layout.addWidget(backup_local_btn)
        
        restore_btn = QPushButton("🔄 Restore Backup")
        restore_btn.clicked.connect(self._restore_backup)
        restore_btn.setMinimumHeight(40)
        buttons_layout.addWidget(restore_btn)
        
        refresh_btn = QPushButton("🔄 Refresh Status")
        refresh_btn.clicked.connect(self._load_backup_status)
        refresh_btn.setMinimumHeight(40)
        buttons_layout.addWidget(refresh_btn)
        
        layout.addLayout(buttons_layout)

        # Backup history
        history_group = QGroupBox("📋 Backup History")
        history_layout = QVBoxLayout(history_group)
        
        self.history_table = QTableWidget()
        self.history_table.setColumnCount(3)
        self.history_table.setHorizontalHeaderLabels(["Location", "Backup Count", "Latest"])
        self.history_table.horizontalHeader().setStretchLastSection(True)
        history_layout.addWidget(self.history_table)
        
        layout.addWidget(history_group)

        # Status label
        self.status_label = QLabel("Ready")
        self.status_label.setStyleSheet("color: #888; padding: 5px;")
        layout.addWidget(self.status_label)

    def _load_backup_status(self):
        """Load and display backup status."""
        status, error = self.controller.get_backup_status()
        
        if error:
            self.status_label.setText(f"❌ Error: {error}")
            return

        if not status:
            self.status_label.setText("No backup status available")
            return

        # Update locations text
        locations_text = ""
        for location, info in status.items():
            exists = "✅" if info["exists"] else "❌"
            count = info["count"]
            latest = info["latest"] or "No backups"
            locations_text += f"{exists} {location}: {count} backups (Latest: {latest})\n"

        self.locations_text.setText(locations_text)

        # Update history table
        self.history_table.setRowCount(len(status))
        row = 0
        for location, info in status.items():
            self.history_table.setItem(row, 0, QTableWidgetItem(location))
            self.history_table.setItem(row, 1, QTableWidgetItem(str(info["count"])))
            self.history_table.setItem(row, 2, QTableWidgetItem(info["latest"] or "-"))
            row += 1

        self.history_table.resizeColumnsToContents()
        self.status_label.setText("✅ Status updated")

    def _backup_all(self):
        """Backup to all locations."""
        self.status_label.setText("🔄 Backing up to all locations...")
        
        results, error = self.controller.backup_all()
        
        if error:
            QMessageBox.warning(self, "Backup Failed", error)
            self.status_label.setText(f"❌ Backup failed: {error}")
            return

        if results:
            success_count = sum(1 for v in results.values() if v)
            total_count = len(results)
            
            if success_count == total_count:
                QMessageBox.information(self, "Backup Complete", 
                    f"✅ Successfully backed up to all {total_count} locations!")
            else:
                QMessageBox.warning(self, "Backup Partial", 
                    f"⚠️ Backup complete: {success_count}/{total_count} locations successful.")
            
            self.status_label.setText(f"✅ Backup complete: {success_count}/{total_count} locations")
            self._load_backup_status()

    def _backup_local(self):
        """Backup to local folder only."""
        self.status_label.setText("🔄 Creating local backup...")
        
        success, error = self.controller.backup_local()
        
        if error:
            QMessageBox.warning(self, "Backup Failed", error)
            self.status_label.setText(f"❌ Local backup failed: {error}")
            return

        if success:
            QMessageBox.information(self, "Backup Complete", 
                "✅ Local backup created successfully in the 'backups' folder!")
            self.status_label.setText("✅ Local backup complete")
            self._load_backup_status()

    def _restore_backup(self):
        """Restore from backup file."""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Select Backup File",
            "backups",
            "Database Files (*.db);;All Files (*.*)"
        )

        if not file_path:
            return

        reply = QMessageBox.question(
            self,
            "Confirm Restore",
            f"⚠️ Restoring will REPLACE your current database!\n\n"
            f"Backup file: {file_path}\n\n"
            f"Are you sure you want to continue?",
            QMessageBox.Yes | QMessageBox.No
        )

        if reply != QMessageBox.Yes:
            return

        self.status_label.setText("🔄 Restoring from backup...")
        
        success, error = self.controller.restore_backup(file_path)
        
        if error:
            QMessageBox.warning(self, "Restore Failed", error)
            self.status_label.setText(f"❌ Restore failed: {error}")
            return

        if success:
            QMessageBox.information(self, "Restore Complete", 
                "✅ Database restored successfully!\n\nPlease restart the application.")
            self.status_label.setText("✅ Restore complete")