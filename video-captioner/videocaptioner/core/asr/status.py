from enum import Enum
from typing import Tuple


class ASRStatus(Enum):
    """ASR processing status with progress percentage.

    Each status contains a tuple of (message, progress_percentage).
    Progress ranges from 0 to 100.
    """

    # Initialization and file handling
    INITIALIZING = ("initializing", 0)
    CONVERTING_AUDIO = ("converting_audio", 5)

    # Local processing phase
    TRANSCRIBING = ("transcribing", 60)
    PROCESSING = ("processing", 70)
    PARSING_RESULT = ("parsing_result", 90)

    # Completion phase (95-100%)
    FINALIZING = ("finalizing", 95)
    COMPLETED = ("completed", 100)

    @property
    def message(self) -> str:
        """Get the status message."""
        return self.value[0]

    @property
    def progress(self) -> int:
        """Get the progress percentage (0-100)."""
        return self.value[1]

    def with_progress(self, progress: int) -> Tuple[int, str]:
        """Create a callback tuple with custom progress.

        Args:
            progress: Progress percentage (0-100)

        Returns:
            Tuple of (progress, message) suitable for callback functions
        """
        return (progress, self.message)

    def callback_tuple(self) -> Tuple[int, str]:
        """Get the callback tuple (progress, message)."""
        return (self.progress, self.message)
