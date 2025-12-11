# 2025-12-11 Design Strategy Planning

## Core Philosophy

**"Discover Once, Use Many Ways"**

ORCS enables analysts to mark up source documents once and export that work in multiple formats for different purposes - documents, graphs, dossiers, and sharing with other analysts.

---

## Primary Data Structures

### 1. Cards (Source Document Based)
The base unit of storage. Original source documents with metadata, analyst markup, and linked data objects.

**Current Card Structure:**
- Original Content (preserved source)
- User Added Section (analyst additions)
- Metadata (classification, source reference, handling instructions, analyst)

### 2. Snippets (Unstructured Text Captures)
Highlighted text from cards with analyst comments. For cut-and-paste into documents/presentations.

**Format:**
```
(Classification) [highlighted text] (comment) [snippet comment]. (Source: source_reference)
```

### 3. Bullets (Structured Statements)
Subject-predicate-object statements with context. Discover once, use as text bullets, graph edges, or attribute rows.

**Format:**
```
(Classification) [subject entity] [relationship/attribute] [object entity] (comment) [bullet comment]. (Source: source_reference)
```

### 4. Dossiers (Entity Based)
Entity-centric views that aggregate:
- All snippets mentioning the entity
- All bullets where entity is subject OR object
- All attributes attached to entity
- Associated KVPs (locations, dates, times)
- User-saved content specific to the dossier

### 5. Notebooks (User Created)
User-assembled content independent of source documents. Analyst's own analysis, notes, and synthesized content.

### 6. Snippet Libraries
Collections of snippets organized by analyst or topic.

### 7. Bullet Tables
Structured collections of bullets for export and analysis.

### 8. Graphs
Visual relationship networks built from bullet/link data.

---

## The Link Model

### Current Problem
Current tags (Entity, Relationship, Attribute, Comment, KVP) were all built to mimic Entity behavior, but they work fundamentally differently:
- Entity = standalone node
- Relationship = edge between two entities
- Attribute = property of an entity (but also can be an entity itself!)
- Comment = annotation
- KVP = key-value pair (but currently no separation between key and value)

### Proposed: Unified Link Model

**Links** are the fundamental connection type. Relationship and Attribute are **properties** of links, not mutually exclusive categories.

```
Link: Bob → phone number 1
Properties: {
  predicate: "user of",
  is_relationship: true,  // appears in edge table
  is_attribute: true,     // appears in attribute table
  kvps: [
    {key: "date", value: "2025-10-03"},
    {key: "time", value: "13:20:00"}
  ]
}
```

### Why This Matters
Some real-world connections are BOTH relationship AND attribute:
- **Phone number**: Attribute OF a person, but also an entity that can CALL other phone numbers
- **Employer**: Attribute OF a person, but also an entity (organization) with its own relationships
- **Location**: Attribute of an event, but also an entity with geographic properties

---

## Multi-Level Comments

Comments exist at EVERY level, not just cards:
- Card-level comments
- Snippet comments
- Bullet comments
- Entity comments
- Link/relationship comments

Each data object can have its own comment section.

---

## Normalization Approaches

Real-world text is messy. ORCS supports multiple approaches to normalize data based on analyst need for accuracy:

### Approach 1: Inline Comments
```
Bob [comment: Robert Richard Renasco] was in place 1 [comment: Place, City, State]
```
Source text preserved, normalized value in comment. Tag references the normalized value.

### Approach 2: Summary Comments
```
[comment: Robert Richard Renasco was in Place, City, State using phone 18001241111 to call Gary Greg Ganu...]
```
Longer text summarized into a single normalized comment.

### Approach 3: Wiki-Link Syntax
```
Bob [[Person:: Robert Richard Renasco]] was in place 1 [[Location:: Place, City, State]]
```
Inline markup that specifies:
- Entity type (Person, Location, Selector, ISOdate)
- Normalized value

**Possible Extended Syntax:**
- Simple: `[[Robert Richard Renasco]]` - just mark as entity
- Typed: `[[Person:: Robert Richard Renasco]]` - explicit type
- Full: `[[Person:: Robert Richard Renasco | Bob]]` - type + normalized + display alias

---

## Export Formats

### Snippet List
For cut-and-paste into documents:
```
(Classification) [highlighted text] (comment) [snippet comment]. (Source: source_reference)
```

### Bullet List
Assembled in plain language:
```
(Classification) [subject] [predicate] [object] (comment) [bullet comment]. (Source: source_reference)
```

### Relationship Table (Edge Table)
For graph export:
```
| Subject | Subject Type | Relationship | Rel Type | Object | Object Type | KVPs | Source |
```

### Attribute Table (Node Table)
For graph export:
```
| Entity | Entity Type | Attribute Type | Attribute | KVPs | Source |
```

---

## End State Capabilities

1. ✅ Store human discovery with provenance
2. 🔲 Cut/paste snippets into documents
3. 🔲 Cut/paste bullets into documents
4. 🔲 Build entity dossiers/target packages
5. 🔲 Export relationship tables to knowledge graphs
6. 🔲 Export attribute tables to SNA/geo-temporal tools
7. 🔲 Convert graph edges back to text bullets
8. 🔲 Import and merge structured data
9. 🔲 Share cards/bullets/snippets in human-readable format
10. 🔲 "Vacuum" shared content into another ORCS instance
11. ✅ Local, human+machine readable storage (card files)
12. 🔲 Self-repairing stable index
13. 🔲 Notebooks for user-created content
14. 🔲 Future: Local AI/MCP integration

---

## Example Decomposition

**Original Text:**
> Bob was in place 1 using phone number 1 when he called Gary who was in place 2 using phone number 2 on date at time.

**One Snippet:**
```
"Bob was in place 1 using phone number 1 when he called Gary who was in place 2 using phone number 2 on date time."
```

**Multiple Bullets:**
| Subject | Predicate | Object | Type | KVPs |
|---------|-----------|--------|------|------|
| Bob | located at | Place 1 | relationship | date, time |
| Gary | located at | Place 2 | relationship | date, time |
| Bob | user of | Phone 1 | relationship + attribute | |
| Gary | user of | Phone 2 | relationship + attribute | |
| Bob | called | Gary | relationship | date, time |
| Phone 1 | called | Phone 2 | relationship | date, time |

**Entity Dossier for "Bob":**
- All snippets mentioning Bob
- All bullets where Bob is subject or object
- Attributes: user of Phone 1
- Related entities: Gary, Place 1, Phone 1
- KVPs: date/time of events

---

## Architecture Questions

1. **Card File Format**: Should link tables be stored within card files, or in separate index files?

2. **Snippet/Bullet Storage**: Inline in cards, or separate table files?

3. **Dossier Persistence**: Live queries vs. saved/cached dossier content?

4. **Wiki-Link Parsing**: Real-time parsing on display, or convert to structured tags on save?

5. **Index Strategy**: How do we build a self-repairing index that survives file moves/renames?

---

## Next Steps

1. Define the Link data model formally
2. Decide on storage architecture (what lives in cards vs. separate files)
3. Design the wiki-link syntax parser
4. Build snippet export functionality
5. Build bullet export functionality
6. Build dossier aggregation views
