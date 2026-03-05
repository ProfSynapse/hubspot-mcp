# HubSpot API Research Summary - Tasks, Meetings, and Calls

**Research Date:** September 22, 2025
**Purpose:** Evaluate API capabilities for implementing new BCPs in the HubSpot MCP integration

## Executive Summary

Based on comprehensive research of HubSpot's 2025 APIs, all three domains (Tasks, Meetings, Calls) provide robust CRUD operations suitable for BCP implementation. Key findings:

- **✅ All APIs support full CRUD operations** (Create, Read, Update, Delete)
- **✅ Rich association capabilities** with contacts, companies, deals
- **✅ 2025 date-based versioning** available for future-proofing
- **✅ Comprehensive property schemas** for detailed data management
- **⚠️ Some recording/transcript limitations** for Calls API

---

## 📋 Tasks API Research

### API Architecture
- **Base URL:** `/crm/v3/objects/tasks`
- **API Type:** Standard CRM objects (like companies, deals)
- **2025 Version:** Available with date-based versioning (2025-09)

### Available Operations
| Operation | Endpoint | Method | Description |
|-----------|----------|---------|-------------|
| Create | `/crm/v3/objects/tasks` | POST | Create new tasks |
| List | `/crm/v3/objects/tasks` | GET | Retrieve tasks with filters |
| Update | `/crm/v3/objects/tasks/{taskId}` | PATCH | Modify existing tasks |
| Delete | `/crm/v3/objects/tasks/{taskId}` | DELETE | Remove tasks (to recycling bin) |
| Search | CRM Search API | POST | Advanced task searching |

### Required Properties
- `hs_timestamp`: Task due date (Unix timestamp or UTC format)

### Key Optional Properties
- `hs_task_subject`: Task title/subject
- `hs_task_body`: Task description/notes
- `hubspot_owner_id`: Assigned user ID
- `hs_task_status`: Current task status
- `hs_task_priority`: Task priority level
- `hs_task_type`: Type of task
- `hs_task_reminders`: Reminder timestamp

### Enumerated Values

**Task Status:**
- `NOT_STARTED`
- `COMPLETED`
- `WAITING`

**Task Priority:**
- `LOW`
- `MEDIUM`
- `HIGH`

**Task Types:**
- `EMAIL`
- `CALL`
- `TODO`

### Association Capabilities
- ✅ Contacts (association type ID: 204)
- ✅ Companies
- ✅ Deals
- ✅ Other CRM objects
- ✅ Batch operations supported
- ✅ Task pinning to record timelines

### Implementation Example
```json
{
  "properties": {
    "hs_timestamp": "2025-09-22T15:30:00.000Z",
    "hs_task_subject": "Follow-up with prospect",
    "hs_task_status": "NOT_STARTED",
    "hs_task_priority": "HIGH",
    "hs_task_type": "TODO"
  },
  "associations": [
    {
      "to": { "id": "contact_id" },
      "types": [
        {
          "associationCategory": "HUBSPOT_DEFINED",
          "associationTypeId": 204
        }
      ]
    }
  ]
}
```

---

## 📅 Meetings API Research

### API Architecture
- **Base URL:** `/crm/v3/objects/meetings`
- **API Type:** Engagement object
- **2025 Version:** Available with date-based versioning

### Available Operations
| Operation | Endpoint | Method | Description |
|-----------|----------|---------|-------------|
| Create | `/crm/v3/objects/meetings` | POST | Create meeting engagements |
| List | `/crm/v3/objects/meetings` | GET | Retrieve meetings |
| Update | `/crm/v3/objects/meetings/{meetingId}` | PATCH | Update meeting details |
| Delete | `/crm/v3/objects/meetings/{meetingId}` | DELETE | Remove meetings |
| Search | CRM Search API | POST | Advanced meeting searching |

### Required Properties
- `hs_timestamp`: Meeting occurrence date/time
- Recommended: `hs_meeting_start_time`

### Key Optional Properties
- `hs_meeting_title`: Meeting subject/title
- `hs_meeting_body`: Meeting description/agenda
- `hs_meeting_location`: Meeting location
- `hs_meeting_external_url`: External meeting link
- `hs_meeting_start_time`: Precise start time
- `hs_meeting_end_time`: Precise end time
- `hs_meeting_outcome`: Meeting result
- `hubspot_owner_id`: Meeting organizer

### Enumerated Values

**Meeting Outcomes:**
- `Scheduled`
- `Completed`
- `Rescheduled`
- `No show`
- `Canceled`

### Association Capabilities
- ✅ Contacts (association type ID: 200)
- ✅ Companies
- ✅ Deals
- ✅ Meeting pinning to timelines
- ✅ Calendar integration support (Google Calendar, Office 365)

### Special Features
- **Calendar Integration:** Supports Google Calendar and Office 365 integration
- **External URLs:** Can log external meeting links but doesn't create calendar events
- **Timeline Pinning:** Pin important meetings to record timelines

### Implementation Example
```json
{
  "properties": {
    "hs_timestamp": "2025-09-22T10:00:00.000Z",
    "hs_meeting_title": "Product Demo",
    "hs_meeting_start_time": "2025-09-22T10:00:00.000Z",
    "hs_meeting_end_time": "2025-09-22T11:00:00.000Z",
    "hs_meeting_outcome": "Scheduled"
  },
  "associations": [
    {
      "to": {"id": "contact_id"},
      "types": [
        {
          "associationCategory": "HUBSPOT_DEFINED",
          "associationTypeId": 200
        }
      ]
    }
  ]
}
```

---

## 📞 Calls API Research

### API Architecture
- **Base URL:** `/crm/v3/objects/calls`
- **API Type:** Engagement object
- **2025 Version:** Available with date-based versioning

### Available Operations
| Operation | Endpoint | Method | Description |
|-----------|----------|---------|-------------|
| Create | `/crm/v3/objects/calls` | POST | Create call engagements |
| List | `/crm/v3/objects/calls` | GET | Retrieve calls |
| Update | `/crm/v3/objects/calls/{callId}` | PATCH | Update call details |
| Delete | `/crm/v3/objects/calls/{callId}` | DELETE | Remove calls |
| Search | CRM Search API | POST | Advanced call searching |

### Required Properties
- `hs_timestamp`: Call creation time (Unix milliseconds or UTC)

### Key Optional Properties
- `hs_call_body`: Call notes/description
- `hs_call_direction`: Call direction (INBOUND/OUTBOUND)
- `hs_call_duration`: Call length in milliseconds
- `hs_call_recording_url`: Secure recording URL
- `hs_call_status`: Current call status
- `hs_call_disposition`: Call outcome
- `hs_call_title`: Call subject
- `hubspot_owner_id`: Call handler

### Enumerated Values

**Call Status:**
- `BUSY`
- `CALLING_CRM_USER`
- `CANCELED`
- `COMPLETED`
- `CONNECTING`
- `FAILED`
- `IN_PROGRESS`
- `NO_ANSWER`
- `QUEUED`
- `RINGING`

**Call Disposition:**
- `Busy`
- `Connected`
- `Left live message`
- `Left voicemail`
- `No answer`
- `Wrong number`

**Call Direction:**
- `INBOUND`
- `OUTBOUND`

### Recording and Transcription Features
- **New 2025 API:** Recordings & Transcripts API
- **Authenticated URLs:** Secure recording uploads
- **Transcription Support:** API-driven transcription workflow
- **Legacy Sunset:** `hs_call_recording_url` property deprecated (Sept 2024)

### Association Capabilities
- ✅ Contacts
- ✅ Companies
- ✅ Deals
- ✅ Call pinning to timelines
- ✅ Voicemail identification

### Implementation Example
```json
{
  "properties": {
    "hs_timestamp": "2025-09-22T14:30:00.000Z",
    "hs_call_direction": "OUTBOUND",
    "hs_call_duration": 300000,
    "hs_call_status": "COMPLETED",
    "hs_call_disposition": "Connected",
    "hs_call_body": "Discussed product requirements"
  },
  "associations": [
    {
      "to": {"id": "contact_id"},
      "types": [
        {
          "associationCategory": "HUBSPOT_DEFINED",
          "associationTypeId": 194
        }
      ]
    }
  ]
}
```

---

## 🔧 Implementation Recommendations

### BCP Architecture Alignment

All three APIs align well with our existing BCP pattern:

```
src/bcps/
├── Tasks/
│   ├── index.ts              # BCP tool registration
│   ├── tasks.service.ts      # TasksService extending HubspotBaseService
│   ├── tasks.create.ts       # Create task tool
│   ├── tasks.get.ts          # Get task tool
│   ├── tasks.update.ts       # Update task tool
│   ├── tasks.list.ts         # List tasks tool
│   └── tasks.search.ts       # Search tasks tool
├── Meetings/
│   └── [similar structure]
└── Calls/
    └── [similar structure]
```

### Authentication Requirements
- **Scopes:** Standard CRM scopes sufficient
- **Rate Limits:** Standard HubSpot API limits apply
- **Security:** All APIs support secure authentication patterns

### Key Implementation Considerations

1. **Use Standard CRM Objects API:** All three use `/crm/v3/objects/` pattern
2. **Association Integration:** Leverage existing association enrichment engine
3. **Response Enhancement:** Integrate with existing suggestion system
4. **Error Handling:** Follow established BCP error patterns
5. **Type Safety:** Create comprehensive TypeScript interfaces

### Priority Implementation Order

1. **Tasks** - Highest priority, simplest implementation
2. **Meetings** - Medium priority, calendar integration considerations
3. **Calls** - Lower priority, recording/transcript complexity

---

## 📊 Comparison Matrix

| Feature | Tasks | Meetings | Calls |
|---------|-------|----------|-------|
| **CRUD Operations** | ✅ Full | ✅ Full | ✅ Full |
| **Association Support** | ✅ All CRM | ✅ All CRM | ✅ All CRM |
| **Search Capability** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Batch Operations** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Status Tracking** | ✅ Rich | ✅ Rich | ✅ Rich |
| **Timeline Pinning** | ✅ Yes | ✅ Yes | ✅ Yes |
| **External Integration** | ❌ N/A | ✅ Calendar | ⚠️ Recording* |
| **Implementation Complexity** | 🟢 Low | 🟡 Medium | 🟡 Medium |

*Recording API has some limitations and requires separate implementation

---

## 🚀 Next Steps

1. **Architecture Phase:** Design BCP structure for selected domains
2. **Implementation Phase:** Build services and tools following established patterns
3. **Testing Phase:** Comprehensive testing with real HubSpot data
4. **Integration:** Update tool registration and delegation systems

**Recommended Start:** Begin with Tasks API implementation as proof of concept, then expand to Meetings and Calls.