# BillSage (Sample App Structure with Real-World Complexity)

**This human-written sketch contains elements of ia_place_map and place_contract elements as they might be used in a real-world design project.**

-Dashboard (place)
  (shows global status reports, surfaced Projections and recent activities)
  (navigates to Report View)
  -Report View (screen under Dashboard)
-Projections (area)
  (simulates future billing cycle outcomes under different fee schedule scenario and funding scenario)
  ...contains:
    -Projections Overview (place)
      (selectable list of linked projections)
      (navigates to Projection)
      List selection actions:
        -Create Projection action 
          (navigates to Create New Projection)
        -Duplicate Projection 
          (shows Duplicate Projection dialog)
        -Delete Projection 
          (shows Delete Projection confirmation dialog)
        -Add to Dashboard
          (shows Add Projection to Dashboard confirmation dialog)
    -Projection (place)
      (shows an outcome that combines a fee schedule scenario with a funding scenario)
      (contains an overview tab with an interactive graph)
      (shows a fee schedules tab with a fee schedule scenario and simple editing options)
      (shows a funds tab with a funding scenario and simple editing options)
      (navigates to Fee Schedule Scenario Details, to Funding Scenario Details)
      -Fee Schedule Scenario Details (place)
        (shows editable details of a fee schedule scenario)
        (navigates back to Projection)
      -Funding Scenario Details (place)
        (shows editable details of a funding scenario)
        (navigates back to Projection)
    -Create New Projection
      (Flow of 3 viewStates, naviates to Projection (showing the new projection) when done
-Current Bills (area)
  (serves to stage, execute and monitor execution of a billing run)
  (contains Current Bills (place) and other places (tbd))
-Review (area)
  (serves to review and verify past billing runs, and to compare them to past projections)
  (contains Review Past Bills (place) and other places (tbd))
-Accounts (area)
  (serves to manage, maintain and examine groups of accounts and individual accounts)
  (contains Manage Accounts (place) and other places (tbd))
-Fee Schedules (area)
  (serves to create, mananage, maintain and examine fee schedules and to assign them to accounts)
  (containts Manage Fee Schedules (place) and other places (tbd))

There is a global navigation (left nav) with the following entries:
-Dashboard
-Projections
-Current Bills
-Review
-Accounts
-Fee Schedules