# Global state variables
dataset = list()																			# Dataset list 
parsedFiles = []																			# Track the status of each parsed file
failedFiles = []																			# Track the status of each failed file
failedImages = []																			# Track which images don't start with a 4C/ID component
WIPFiles = []																				# Track the files that contain Work-in-progress items
ignoredFiles = []																			# Track the files that have an ignore tag
taxcoReport = {}																			# Report 1 data
contentReport = {}																			# Report 2 data

# Constants
SRC_DIR = "src/storage/content_repo/content"												# Source directory where the markdown files are located
DEST_DIR = "src/storage/content_repo/build"								  					# Destination directory where the updated markdown files will be saved
TAXCO_REPORT_PATH = "src/storage/content_repo/taxco_report.md"								# Taxco report path where the taxco report will be saved
CONTENT_REPORT_PATH = "src/storage/content_repo/content_report.md"							# Content report path where the content report will be saved
DATASET = "src/storage/dataset/dataset.xlsx" 												# Dataset containing the taxonomie information
TODO_PATTERN = r'-=[A-Z]+=-' 									                            # Regex pattern to find TODO items
TAXONOMIE_PATTERN = r'^[a-z]{2}-\d{1,3}\.[123]\.[^\s\.]+(-[^\s\.]+)*\.(?:OI|DT|PI|LT)$'     # Taxonomie regex
VALID_DYNAMIC_LINK_PREFIXES = ['https://', 'http://', 'tags/']								# List of valid dynamic links
IGNORE_FOLDERS = ["schrijfwijze"] 															# Folders to ignore when parsing the markdown files

VERBOSE = False 																			# Flag to enable verbose output

# 4CID names
LT = "Leertaken"
OI = "Ondersteunende-informatie" 
PI = "Procedurele-informatie"
DT = "Deeltaken"

# Dataset columns numbers
TC1_COL = 0
TC2_COL = 1
TC3_COL = 4
PROCES_COL = 2
PROCESSTAP_COL = 3
LT_COL = 6
OI_COL = 7
PI_COL = 8
DT_COL = 9

# Error message for not including any taxonomy code
ERROR_INVALID_TAXCO = "Ongeldige taxco: "
ERROR_NO_TAXCO_FOUND = "Geen taxco gevonden"
ERROR_TAXCO_NOT_FOUND = "Taxco niet in dataset: "
ERROR_TAXCO_NOT_NEEDED = "Taxco gebruikt wanneer niet nodig: "
ERROR_IGNORE_TAG_USED = "Bestand wordt genegeerd door ignore tag"

# Error message for images
ERROR_IMAGE_NOT_FOUND = "Afbeelding niet gevonden: "
ERROR_IMAGE_NOT_USED = "Afbeelding wordt niet gebruikt"

# Error message for dynamic links
ERROR_INVALID_DYNAMIC_LINK = "Dynamische link fout: "

# WIP errors
ERROR_WIP_FOUND = "Work-in-progress items gevonden: "

# Icons
SUCCESS_ICON = "✅"
FAIL_CIRCLE_ICON = "⛔️"
FAIL_CROSS_ICON = "❌"
NOT_NECESSARY_ICON = "🏳️"
WARNING_ICON = "⚠️"
NOT_NEEDED_ICON = "🟠"
TODO_ITEMS_ICON = "🔨"
