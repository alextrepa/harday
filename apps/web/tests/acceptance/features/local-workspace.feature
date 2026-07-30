Feature: Open the local time workspace
  TimeTracker users can begin daily time entry without signing in to a remote service.

  Scenario: Open today's workspace from a clean browser
    Given I have no saved TimeTracker workspace
    When I open today's time workspace
    Then the Time workspace is visible
    And the timesheet can be submitted
