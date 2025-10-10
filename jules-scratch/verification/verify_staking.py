import time
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    page.goto("http://localhost:3000/staking/dashboard", timeout=60000)
    page.wait_for_load_state("networkidle", timeout=60000)
    page.screenshot(path="jules-scratch/verification/staking_dashboard.png", timeout=60000)
    browser.close()

with sync_playwright() as playwright:
    run(playwright)