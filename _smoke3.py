"""Probe why Ctrl+K QShortcut may not fire. Run: python _smoke3.py"""
import os
os.environ["QT_QPA_PLATFORM"] = "offscreen"
os.environ["ERP_DB_ENGINE"] = "sqlitecloud"
os.environ["SQLITE_CLOUD_URL"] = "sqlitecloud://127.0.0.1:1/DO-NOT-CONNECT?apikey=none"

from PySide6.QtCore import Qt
from PySide6.QtTest import QTest
from PySide6.QtWidgets import QApplication
APP = QApplication([])

from models.user import User
from views.main_window import MainWindow

user = User(id=1, username="admin", full_name="Admin User", role_id=1, role_name="Admin")
w = MainWindow(user, None, lazy_load=True)
w.resize(1200, 800)
w.show()

# Spy on the shortcut targets.
calls = {}
orig = w._open_palette
def spy_open():
    calls["palette"] = calls.get("palette", 0) + 1
w._open_palette = spy_open
calls["goto"] = 0
import functools
orig_goto = w._goto_index
def spy_goto(i):
    calls["goto"] += 1
w._goto_index = spy_goto

# Give the window focus.
w.activateWindow()
APP.processEvents()

# Fire Ctrl+K
QTest.keyClick(w, Qt.Key.Key_K, Qt.ControlModifier)
APP.processEvents()
print("after Ctrl+K, _open_palette calls =", calls.get("palette", 0))

# Fire Ctrl+2 (index 1)
QTest.keyClick(w, Qt.Key.Key_2, Qt.ControlModifier)
APP.processEvents()
print("after Ctrl+2, _goto calls =", calls.get("goto", 0))

# Also try via the nav_filter child focused
w.nav_filter.setFocus()
APP.processEvents()
QTest.keyClick(w.nav_filter, Qt.Key.Key_K, Qt.ControlModifier)
APP.processEvents()
print("after Ctrl+K on nav_filter child, _open_palette calls =", calls.get("palette", 0))

print("DONE")