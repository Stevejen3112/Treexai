import re
from playwright.sync_api import sync_playwright, Page, expect

def test_staking_pool_apr_filter(page: Page):
    """
    This test verifies that the APR filter on the staking pools page
    has a dynamic maximum value and that a high-APR pool is visible.
    """
    # 1. Arrange: Go to the staking pools page.
    # The frontend is running on port 3000.
    page.goto("http://localhost:3000/staking/pool")

    # 2. Assert: Wait for the page title to be correct.
    expect(page).to_have_title("Staking Pools")

    # Wait for the pools to load by looking for a pool card.
    # We'll wait up to 30 seconds for the pools to appear.
    expect(page.locator('div.grid > div').first).to_be_visible(timeout=30000)

    # 3. Act & Assert: Check the APR slider's maximum value.
    # The slider component renders a span with role="slider".
    slider_span = page.locator('span[role="slider"]')
    expect(slider_span).to_be_visible()

    # The max value is stored in the 'aria-valuemax' attribute.
    max_apr_value_str = slider_span.get_attribute("aria-valuemax")
    assert max_apr_value_str is not None, "The 'aria-valuemax' attribute was not found on the slider."

    max_apr_value = float(max_apr_value_str)
    assert max_apr_value > 20, f"Expected max APR to be > 20, but it was {max_apr_value}"

    # Verify the 100% APR pool is visible.
    # We look for text indicating a high APR.
    high_apr_pool = page.get_by_text(re.compile("100.00%"))
    expect(high_apr_pool).to_be_visible()

    # 4. Screenshot: Capture the final result for visual verification.
    page.screenshot(path="jules-scratch/verification/staking-pools-page.png")

# Boilerplate to run the test
if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        test_staking_pool_apr_filter(page)
        browser.close()