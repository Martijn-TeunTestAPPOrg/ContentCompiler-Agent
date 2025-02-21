import re, logging
from config import dataset, contentReport
from config import PROCES_COL, PROCESSTAP_COL, TC1_COL, TC2_COL, TC3_COL, TAXONOMIE_PATTERN, TODO_PATTERN, ERROR_INVALID_TAXCO, ERROR_NO_TAXCO_FOUND, ERROR_TAXCO_NOT_FOUND, ERROR_TAXCO_NOT_NEEDED
from report.generateTaxcoReport import updateProcessReportData, updateSubjectReportData


"""
Generate tags based on the taxonomie values
Args:
    taxonomies (list): List of taxonomie values.
    existingTags (list): List of existing tags.
    filePath (str): Path to the markdown file being processed.
"""
def generateTags(taxonomies, existingTags, filePath):
    tags = []
    errors = []
    combinedTags = []
    taxonomieTags = []

    if taxonomies is not None and taxonomies != ['None'] and taxonomies != [''] and taxonomies != []:
        for taxonomie in taxonomies:
            # Check if the taxonomie is in the correct format
            if not re.match(TAXONOMIE_PATTERN, taxonomie):
                errors.append(f"{ERROR_INVALID_TAXCO} `{taxonomie}`")
                logging.warning(f"{ERROR_INVALID_TAXCO} `{taxonomie}` in bestand: {filePath}")
                continue

            # Split the taxonomie in it's different parts
            extractedTC1, extractedTC2, extractedTC3, extractedTC4 = splitTaxonomie(taxonomie)
            
            # If the parts are all valid
            if extractedTC1 and extractedTC2 and extractedTC3 and extractedTC4:
                # Loop trough every row in the dataset
                for row in dataset[1:]:
                    # Check if the first part of the taxonomie is equal to the TC1 column
                    if row[TC1_COL] == extractedTC1:                        
                        # Check if the second part of the taxonomie is equal to the TC2 column
                        if row[TC3_COL] in contentReport and row[TC3_COL] == extractedTC3:
                            # Adds the taxonomie
                            newTag = "HBO-i/niveau-" + extractedTC2
                            if newTag not in tags:
                                tags.append(newTag)
    
                            # Adds the proces
                            if row[PROCES_COL] not in tags:
                                tags.append(row[PROCES_COL])

                            # Adds the processtap
                            if row[PROCESSTAP_COL] not in tags:
                                tags.append(row[PROCESSTAP_COL])

                            # Check if the third part of the taxonomie is in the lookup table
                            if row[TC3_COL] not in tags:
                                tags.append(row[TC3_COL])

                            # Check if the taxonomie is not needed
                            splittedRow =  row[TC2_COL].split(',')
                            if splittedRow[int(extractedTC2)-1] == "X": 
                                errors.append(f"{ERROR_TAXCO_NOT_NEEDED} `{taxonomie}`")
                                logging.warning(f"{ERROR_TAXCO_NOT_NEEDED} `{taxonomie}` in bestand: {filePath}")

                            # Update the process report data with the new values
                            # This is needed so the report has the correct data
                            # Before the script runs it pre-fills the report with all the taxonomies
                            # This is done so the report has all the taxonomies even if they are not used
                            # After this the report is updated with the correct data
                            updateProcessReportData(extractedTC1, extractedTC2)
                            updateSubjectReportData(extractedTC1, extractedTC2, extractedTC3, extractedTC4)

            # If no tags were found, add an error
            if tags == [] and not errors:
                errors.append(f"{ERROR_TAXCO_NOT_FOUND} `{taxonomie}`")   
                logging.warning(f"{ERROR_TAXCO_NOT_FOUND} `{taxonomie}` in bestand: {filePath}")
    else:
        errors.append(f"{ERROR_NO_TAXCO_FOUND}")
        logging.warning(f"{ERROR_NO_TAXCO_FOUND} in bestand: {filePath}")

    # Combine the existing tags with the new tags
    if existingTags: combinedTags += existingTags 
    if tags : combinedTags += tags 
    if taxonomieTags : combinedTags += taxonomieTags
    
    # Sort combined_tags so that "HBO-i/niveau-" tags are moved to the start
    combinedTags = sorted(combinedTags, key=lambda tag: (not tag.startswith("HBO-i/niveau-"), tag))

    return list(dict.fromkeys(combinedTags)), errors

def splitTaxonomie(taxonomie):
    return taxonomie.split('.')

# Helper function to extract specific values from the content of a markdown file.
def extractHeaderValues(content, fieldName):
    lines = content.splitlines()
    values = []

    for i, line in enumerate(lines):
        if line.startswith(f'{fieldName}:'):
            # Handle case where the field has a single value
            if ':' in line and len(line.split(':', 1)[1].strip()) > 0:
                values.append(line.split(':', 1)[1].strip())
            else:
                # Handle case where the field is a list
                for j in range(i + 1, len(lines)):
                    subLine = lines[j].strip()
                    if subLine.startswith('- '):
                        values.append(subLine.lstrip('- ').strip())
                    else:
                        break
            break

    return values if values else None

# Helper function to find all the To-Do items in the content of a markdown file.	
def findWIPItems(content):
    return re.findall(TODO_PATTERN, content)

# Helper function to check if a file has an ignore tag.
def hasIgnoreTag(content, filePath):
    ignoreTAG = extractHeaderValues(content, 'ignore')
        
    if ignoreTAG:        
        if "true" in ignoreTAG:
            logging.info(f"File has an ignore tag, ignoring file: {filePath}")
            return True
            
    return False
