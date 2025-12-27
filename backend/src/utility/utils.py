import os
import yaml
from src.utility.path_finder import Finder
from src.utility.logger import AppLogger

logger = AppLogger.get_logger(__name__)


class Utility:
    def __init__(self):
        self.paths = Finder()

    def load_prompts(self, filepath="prompts.yml"):
        base_path = self.paths.get_directory(name="config")
        full_path = os.path.join(base_path, filepath)
        try:
            with open(full_path, "r") as f:
                return yaml.safe_load(f)
        except Exception as e:
            logger.error(f"Unable to open file: {e}")
