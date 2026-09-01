# Solving for Good Node Rendering

New node concepts:

- decorators
- consolidated attributes

Approach:

- Unified Node Renderer
- Composition concept: inside-out, "occupy-space, then enclose"
- Closely follow design details
- Provide CSS access to design details
- "Include font weights"

Specify design-defining details:

- element list
- font sizes
- font weights
- character spacing
- line spacing
- layout margins
- layout spacing
- layout levels
- edge radius
- edge thickness
- edge line placement
- font colors
- background colors
- edge colors
- header height

Element List:

node container:
    notes:
        width is fixed
        height hugs content
    uses a vertical layout:
        notes:
            "node body" is always present as content
            "decorator header" is also present as content if "--decorators" CLI option is other than "none"
            layout content items vertically separated by layout spacing
            layout content items separated from container edges by layout padding
            layout item width fills container
        layout content:
            decorator header (conditional)
            node body
    properties:
        node container background color
        node container edge line color 
        node container edge line placement
        node container edge line thickness
        node container corner radius
        node container layout padding
        node container layout spacing
        
decorator header:
    notes:
        width fills container
        height is fixed
    uses a horizontal layout:
        notes:
            contains 1 or 2 decorator items, based on "--decorators" CLI option
            layout content items horizontally separated by layout spacing
            layout content items separated from left container edge by layout padding
            layout content item height: fill container ("same as container")
            layout content item vertical text alignment: centered
        layout content:
            node type
                notes:
                    this is a text displaying the node type
                    present for "--decorators type", "--decorators type,id"
            node ID
                notes:
                    this is a text displaying the node ID
                    present for "--decorators id", "--decorators type,id"
    properties:
        decorator header height
        decorator header background color
        decorator header font size
        decorator header font weight
        decorator header layout spacing
        decorator header layout padding

node body:
    uses a vertical layout:
        notes:
            shows node title followed by (if present) node attribute groups
            layout content items vertically separated by layout spacing
            layout content items separated from container edges by layout padding
            container hugs content
        layout content:
            node title
            attibute groups (0-n)
    properties:
        node body layout padding
        node body layout spacing

node title:
    notes:
        this is a text displaying the node title
        there a two cases that differ in display of the node title:
            1. "dense node": 
            
            when the combined height of all node content exceeds the default minimum node height. (usually the case when the node DOES contain annotations, or the node does display a decorator header, or both, or the title occupies more than a single line in the node.)

            for a dense node, we treat the node title as a list item within "node body". It claims its vertical space, "node body" and "node container" will hug the content vertically and the result looks good.

            2. "plain node": 
            
            when the combined height of all node content does NOT exceed the default minimum node height. (this can be the case the node shows ONLY the title and the title occupies only a single line.)

            for a plain node, treating the title as a simple list item will display the title vertically off-center. thus the title needs to be treated as a text box that vertically fills its container, and uses explicit "align: middle" for its text.
    content:
        node title (text, see notes above)
    properties:
        title font
        title font color
        title font size
        title font weight
        title line height
        title alignment (see notes above)

attribute group:
    uses a vertical layout:
        notes:
            this is a label: content combination
            shows a node attribute
            (or:) shows multiple node attributes of the same type (if present) under the same label
            layout content items vertically separated by layout spacing
            layout content items separated from container edges by layout padding
            container hugs content
        content:
            attribute label
            attribute content (1 to N)
    properties:
        attribute label font
        attribute label font color
        attribute label font size
        attribute label font weight
        attribute label line height
        attribute content font
        attribute content font color
        attribute content font size
        attribute content font weight
        attribute content line height
