"""
Skeleton loader widget for perceived performance optimization.

Shows animated placeholder content while data is loading,
making the application feel faster and more responsive.
"""
from __future__ import annotations

from PySide6.QtCore import QPropertyAnimation, QEasingCurve, Property, QTimer
from PySide6.QtGui import QColor, QPainter, QPaintEvent
from PySide6.QtWidgets import QLabel, QVBoxLayout, QWidget


class SkeletonLine(QWidget):
    """A single animated skeleton line."""
    
    def __init__(self, width: int = -1, height: int = 16, parent=None):
        super().__init__(parent)
        self._width = width
        self._height = height
        self._pulse_position = 0.0
        self._animation = QPropertyAnimation(self, b"pulsePosition")
        self._animation.setDuration(1200)
        self._animation.setEasingCurve(QEasingCurve.InOutSine)
        self._animation.setStartValue(0.0)
        self._animation.setEndValue(1.0)
        self._animation.setLoopCount(-1)  # Infinite loop
        
        # Colors
        self._base_color = QColor(240, 240, 240)
        self._highlight_color = QColor(255, 255, 255)
        
        self.setFixedHeight(height)
        if width > 0:
            self.setFixedWidth(width)
    
    @Property(float)
    def pulsePosition(self) -> float:
        return self._pulse_position
    
    @pulsePosition.setter
    def pulsePosition(self, value: float):
        self._pulse_position = value
        self.update()
    
    def start_animation(self):
        """Start the pulse animation."""
        self._animation.start()
    
    def stop_animation(self):
        """Stop the pulse animation."""
        self._animation.stop()
    
    def paintEvent(self, event: QPaintEvent):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        # Draw base rectangle
        painter.setBrush(self._base_color)
        painter.setPen(Qt.NoPen)
        painter.drawRoundedRect(self.rect(), 4, 4)
        
        # Draw highlight pulse
        if self._pulse_position > 0:
            highlight_width = int(self.width() * 0.3)
            highlight_x = int((self.width() - highlight_width) * self._pulse_position)
            
            gradient = QLinearGradient(highlight_x, 0, highlight_x + highlight_width, 0)
            gradient.setColorAt(0, QColor(255, 255, 255, 0))
            gradient.setColorAt(0.5, self._highlight_color)
            gradient.setColorAt(1, QColor(255, 255, 255, 0))
            
            painter.setBrush(gradient)
            painter.drawRoundedRect(
                highlight_x, 0, highlight_width, self.height(),
                4, 4
            )
        
        painter.end()


from PySide6.QtCore import Qt
from PySide6.QtGui import QLinearGradient


class SkeletonLoader(QWidget):
    """
    Skeleton loader widget with multiple rows and columns.
    
    Usage:
        skeleton = SkeletonLoader(rows=5, columns=3)
        layout.addWidget(skeleton)
        skeleton.start_animation()
        
        # When data loads:
        skeleton.stop_animation()
        skeleton.hide()
    """
    
    def __init__(
        self,
        rows: int = 5,
        columns: int = 1,
        column_widths: list[int] | None = None,
        spacing: int = 8,
        parent=None
    ):
        super().__init__(parent)
        self._rows = rows
        self._columns = columns
        self._lines: list[SkeletonLine] = []
        
        # Setup layout
        layout = QVBoxLayout(self)
        layout.setSpacing(spacing)
        layout.setContentsMargins(0, 0, 0, 0)
        
        # Create skeleton lines
        for row in range(rows):
            row_widget = QWidget()
            row_layout = QHBoxLayout(row_widget)
            row_layout.setContentsMargins(0, 0, 0, 0)
            row_layout.setSpacing(spacing)
            
            for col in range(columns):
                # Determine width for this column
                if column_widths and col < len(column_widths):
                    width = column_widths[col]
                else:
                    width = -1  # Stretch
                
                line = SkeletonLine(width=width, height=16)
                row_layout.addWidget(line)
                self._lines.append(line)
            
            if columns == 1:
                # Single column: add stretch to control width
                row_layout.addStretch()
            
            layout.addWidget(row_widget)
    
    def start_animation(self):
        """Start all skeleton animations."""
        for line in self._lines:
            line.start_animation()
        self.show()
    
    def stop_animation(self):
        """Stop all skeleton animations."""
        for line in self._lines:
            line.stop_animation()
        self.hide()
    
    def set_rows(self, rows: int):
        """Update number of rows (recreates skeleton)."""
        self._rows = rows
        # Clear existing
        while self.layout().count():
            item = self.layout().takeAt(0)
            if item.widget():
                item.widget().deleteLater()
        self._lines.clear()
        
        # Recreate
        for row in range(rows):
            row_widget = QWidget()
            row_layout = QHBoxLayout(row_widget)
            row_layout.setContentsMargins(0, 0, 0, 0)
            
            for col in range(self._columns):
                line = SkeletonLine(width=-1, height=16)
                row_layout.addWidget(line)
                self._lines.append(line)
            
            row_layout.addStretch()
            self.layout().addWidget(row_widget)


from PySide6.QtWidgets import QHBoxLayout


class LoadingOverlay(QWidget):
    """
    Semi-transparent overlay with loading indicator.
    
    Usage:
        overlay = LoadingOverlay(parent_widget)
        overlay.show("Loading data...")
        
        # When done:
        overlay.hide()
    """
    
    def __init__(self, parent: QWidget):
        super().__init__(parent)
        self.setObjectName("loadingOverlay")
        self.setStyleSheet("""
            #loadingOverlay {
                background-color: rgba(255, 255, 255, 200);
            }
        """)
        
        # Setup layout
        layout = QVBoxLayout(self)
        layout.setAlignment(Qt.AlignCenter)
        
        # Loading label
        self.label = QLabel("Loading...")
        self.label.setStyleSheet("""
            font-size: 16px;
            color: #666;
            padding: 20px;
        """)
        layout.addWidget(self.label)
        
        # Start hidden
        self.hide()
    
    def show(self, message: str = "Loading..."):
        """Show overlay with custom message."""
        self.label.setText(message)
        super().show()
        self.raise_()  # Bring to front
    
    def hide(self):
        """Hide overlay."""
        super().hide()


class TableSkeleton(QWidget):
    """
    Skeleton loader specifically designed for table views.
    
    Creates a grid-like appearance matching table structure.
    """
    
    def __init__(
        self,
        rows: int = 10,
        columns: int = 5,
        column_ratios: list[float] | None = None,
        parent=None
    ):
        super().__init__(parent)
        self._rows = rows
        self._columns = columns
        self._column_ratios = column_ratios or [1.0] * columns
        
        layout = QVBoxLayout(self)
        layout.setSpacing(4)
        layout.setContentsMargins(0, 0, 0, 0)
        
        self._lines = []
        
        # Header row (darker)
        header_widget = QWidget()
        header_layout = QHBoxLayout(header_widget)
        header_layout.setContentsMargins(0, 0, 0, 0)
        header_layout.setSpacing(4)
        
        for col in range(columns):
            line = SkeletonLine(height=20)
            line._base_color = QColor(220, 220, 220)  # Darker for header
            header_layout.addWidget(line, int(self._column_ratios[col] * 10))
            self._lines.append(line)
        
        layout.addWidget(header_widget)
        
        # Data rows
        for row in range(rows):
            row_widget = QWidget()
            row_layout = QHBoxLayout(row_widget)
            row_layout.setContentsMargins(0, 0, 0, 0)
            row_layout.setSpacing(4)
            
            for col in range(columns):
                line = SkeletonLine(height=16)
                row_layout.addWidget(line, int(self._column_ratios[col] * 10))
                self._lines.append(line)
            
            layout.addWidget(row_widget)
    
    def start_animation(self):
        for line in self._lines:
            line.start_animation()
        self.show()
    
    def stop_animation(self):
        for line in self._lines:
            line.stop_animation()
        self.hide()
