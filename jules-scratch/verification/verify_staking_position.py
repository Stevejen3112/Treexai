import re
from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # 1. Navigate to the login page
        page.goto("http://localhost:3000/login")

        # 2. Enter credentials and log in
        page.get_by_label("Email").fill("superadmin@example.com")
        page.get_by_label("Password").fill("12345678")
        page.get_by_role("button", name="Login").click()

        # Wait for navigation to the dashboard
        expect(page).to_have_url(re.compile(".*dashboard"))

        # 3. Navigate to the staking positions page
        page.goto("http://localhost:3000/staking/position")

        # Wait for the page to load and for the positions to be displayed
        # We can wait for the summary section to be visible
        expect(page.get_by_text("My Staking Positions")).to_be_visible()

        # 4. Take a screenshot
        page.screenshot(path="jules-scratch/verification/staking_position_page.png")

        print("Screenshot taken successfully.")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")

    finally:
        # Close the browser
        browser.close()

with sync_playwright() as playwright:
    run(playwright)