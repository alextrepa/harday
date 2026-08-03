Feature: Open the local time workspace
  TimeTracker users can begin daily time entry without signing in to a remote service.

  Scenario: Open today's workspace from a clean browser
    Given I have no saved TimeTracker workspace
    When I open today's time workspace
    Then the Time workspace is visible
    And the timesheet can be submitted

  Scenario: Install a packaged connector from local files
    Given I have no saved TimeTracker workspace
    When I install a packaged connector from settings
    Then the connector plugin is reported as installed
    And I can open the connector plugin configuration

  Scenario: Deactivate a plugin without losing its configuration page
    Given I have no saved TimeTracker workspace
    When I install a packaged connector from settings
    And I deactivate the connector plugin with the keyboard
    Then the inactive connector plugin remains configurable

  Scenario: Redirect the former connectors settings route
    Given I have no saved TimeTracker workspace
    When I open the former connectors settings route
    Then I arrive at the plugins catalog

  Scenario: Explain an empty plugin catalog
    Given I have no saved TimeTracker workspace
    When I open the plugins catalog
    Then the empty plugin catalog is explained
    And Outlook Calendar is not offered

  Scenario: Uninstall a packaged connector while preserving imported work
    Given I have no saved TimeTracker workspace
    When I install a packaged connector from settings
    And I open the connector plugin configuration
    And I uninstall the connector plugin
    Then the connector plugin is reported as uninstalled

  Scenario: Configure a development plugin directory from Debug settings
    Given I have no saved TimeTracker workspace
    When I open development plugin settings
    Then I can choose a development plugin directory
