import re
    
from bs4 import BeautifulSoup
from time import sleep
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select
from selenium.webdriver.chrome.options import Options
import time
import json

def deduplicate_schedule(days_times):
    if isinstance(days_times, list):
        # Create a set of tuples to remove duplicates
        unique_times = {(item['day'], item['startTime'], item['endTime']) 
                       for item in days_times}
        
        # Convert back to list of dictionaries
        return [
            {
                "day": day,
                "startTime": start,
                "endTime": end
            }
            for day, start, end in unique_times
        ]
    return days_times


def parse_days_times(days_times_str):
    if days_times_str == "--" or days_times_str == "Unknown":
        return [{"day": "Unknown", "startTime": "Unknown", "endTime": "Unknown"}]
    
    # Split into different day-time combinations
    schedule = []
    # Handle multiple days with different times
     # Handle combined days (like TuTh, MoWe)
    day_pairs = {
        "MoWe": ["Mo", "We"],
        "TuTh": ["Tu", "Th"],
        "MoTuWeThFr": ["Mo", "Tu", "We", "Th", "Fr"],
        "MoTuWeTh": ["Mo", "Tu", "We", "Th"]
    }
    
    # Pattern matches combined days and single days
    day_time_pairs = re.findall(r'((?:Mo|Tu|We|Th|Fr)+)\s+(\d+:\d+(?:AM|PM))\s*-\s*(\d+:\d+(?:AM|PM))', days_times_str)
    
    for days, start, end in day_time_pairs:
        if days in day_pairs:
            # Split combined days into individual days
            for single_day in day_pairs[days]:
                schedule.append({
                    "day": single_day,
                    "startTime": start,
                    "endTime": end
                })
        else:
            # Handle single day
            schedule.append({
                "day": days,
                "startTime": start,
                "endTime": end
            })
   
    
    return schedule if schedule else "Unknown"
    
    # Set up Chrome options
def scrape_cuny_classes():
    classes_data = []  # List to store all class dictionaries
    chrome_options = Options()
    # chrome_options.add_argument('--headless')  # Uncomment to run in headless mode
    
    driver = webdriver.Chrome(options=chrome_options)
    wait = WebDriverWait(driver, 10)
    
    try:
        url = "https://globalsearch.cuny.edu/CFGlobalSearchTool/search.jsp"
        driver.get(url)
        time.sleep(1)  # Initial load wait
        
        # Select Brooklyn College using JavaScript
        college_script = """
        document.querySelector('input[value="BKL01"]').click();
        """
        driver.execute_script(college_script)
        time.sleep(1)

        driver.execute_script("window.scrollTo({ top: 300, behavior: 'smooth' });")
        time.sleep(1)
        
        # Select Term using JavaScript
        term_select = wait.until(EC.presence_of_element_located((By.NAME, "term_value")))
        term_dropdown = Select(term_select)
        term_dropdown.select_by_value("1252")  # 2025 Spring Term
        time.sleep(1)

        next_button = wait.until(EC.element_to_be_clickable((By.NAME, "next_btn")))
        next_button.click()
        time.sleep(1)

        # Select Computer Science subject using JavaScript
        subject_select = wait.until(EC.presence_of_element_located((By.NAME, "subject_name")))
        subject_dropdown = Select(subject_select)
        subject_dropdown.select_by_value("CMIS")
        time.sleep(1)

        # Select Undergraduate level
        career_select = wait.until(EC.presence_of_element_located((By.NAME, "courseCareer")))
        career_dropdown = Select(career_select)
        career_dropdown.select_by_value("UGRD")
        time.sleep(1)

        driver.execute_script("window.scrollTo({ top: 300, behavior: 'smooth' });")
        time.sleep(1)

        driver.execute_script("window.scrollTo({ top: 10000, behavior: 'smooth' });")
        time.sleep(1)

        college_script = """
        document.querySelector('input[value="P"]').click();
        """
        driver.execute_script(college_script)


        next_button = wait.until(EC.element_to_be_clickable((By.ID, "search_new_spin")))
        next_button.click()
        time.sleep(2)

        # # Rest of your code remains the same...
        soup = BeautifulSoup(driver.page_source, "html.parser")
        # print(soup.find_all("table", class_=("classinfo")))
        class_rows = soup.find_all("tr")

        for row in class_rows:
            try:
                # Extract data from each column using data-label attributes
                class_number = row.find("td", {"data-label": "Class"})
                section = row.find("td", {"data-label": "Section"})
                days_times = row.find("td", {"data-label": "DaysAndTimes"})
                room = row.find("td", {"data-label": "Room"})
                instructor = row.find("td", {"data-label": "Instructor"})
                mode = row.find("td", {"data-label": "Instruction Mode"})
                dates = row.find("td", {"data-label": "Meeting Dates"})
                topic = row.find("td", {"data-label": "Course Topic"})
                room_text = room.get_text(strip=True)
                if "Inger Add" in room_text:
                        room_text = room_text.replace("Inger Add", "Ingersoll Extension")

                instructors = instructor.stripped_strings
                instructor_list = list(instructors)
                if class_number:  # Only process rows that have class information
                    class_info = {
                        "class_number": class_number.get_text(strip=True),
                        "section": section.get_text(strip=True),
                        "days_times": deduplicate_schedule(parse_days_times(days_times.get_text(strip=True))),
                        "room": room_text,
                        "instructor": instructor_list,
                        "mode": mode.get_text(strip=True),
                        "meeting_dates": (dates.get_text(strip=True)),
                        "course_topic": topic.get_text(strip=True)
                    }
                    if class_info["days_times"] == "--":
                        class_info["days_times"] = "Unknown"
                    if class_info["room"] == "":
                        class_info["room"] = "Unknown"

                    classes_data.append(class_info)

                    with open("courses.json", "w") as file:
                        json.dump(classes_data, file, indent=2)
                    file.write("\n")

            except Exception as e:
                print(f"An error occurred: {str(e)}")

        return classes_data            
    except Exception as e:
        print(f"An error occurred: {str(e)}")
        
    finally:
        driver.quit()

if __name__ == "__main__":
    print(scrape_cuny_classes())