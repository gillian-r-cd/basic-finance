"""
catalog.py - Structured component catalog for the Agent to select from.
Main data: COMPONENT_CATALOG (list of dicts describing each available component).
Functions: get_catalog_for_prompt(unit_topic, domain) returns a formatted string for LLM context
             (filtered by domain then by topic relevance),
           get_valid_names() returns a set of valid component names for backend validation.
"""

COMPONENT_CATALOG = [
    {
        "name": "CompoundInterestChart",
        "domain": "finance",
        "description": "Interactive line chart comparing compound interest vs simple interest over time. Learner drags sliders for rate and years to see exponential vs linear growth.",
        "applicable_knowledge_types": ["causal"],
        "applicable_topics": ["compound interest", "time value of money", "exponential growth"],
        "props_schema": {
            "initialPrincipal": {"type": "number", "default": 10000, "description": "Starting investment amount"},
            "rateRange": {"type": "[number, number]", "default": [0.01, 0.15], "description": "Min and max annual return rate"},
            "yearsRange": {"type": "[number, number]", "default": [1, 40], "description": "Min and max time horizon in years"},
        },
    },
    {
        "name": "EmergencyBufferComparison",
        "domain": "finance",
        "description": "Area chart showing the long-term wealth impact of having an emergency buffer vs being forced to sell investments during a market downturn. Learner adjusts buffer months.",
        "applicable_knowledge_types": ["causal"],
        "applicable_topics": ["emergency fund", "liquidity", "forced selling", "market drawdown", "safety margin"],
        "props_schema": {
            "initialPortfolio": {"type": "number", "default": 20000, "description": "Initial portfolio value"},
            "marketDrop": {"type": "number", "default": 0.3, "description": "Market drop fraction (0-1)"},
            "emergencyNeed": {"type": "number", "default": 3000, "description": "Emergency cash need"},
        },
    },
    {
        "name": "RiskReturnScatter",
        "domain": "finance",
        "description": "Scatter plot showing different asset classes positioned by historical risk (volatility) and return. Helps learner see the risk-return tradeoff visually.",
        "applicable_knowledge_types": ["causal", "structural"],
        "applicable_topics": ["risk and return", "asset classes", "volatility", "risk premium", "diversification"],
        "props_schema": {
            "assets": {
                "type": "array of {name, risk, return}",
                "description": "Array of asset objects with name, risk (std dev), and return (annual %)",
                "default": "preset financial assets",
            },
        },
    },
    {
        "name": "InflationTimeline",
        "domain": "finance",
        "description": "Line chart showing how inflation erodes purchasing power over time. Learner adjusts inflation rate to see the real value of money shrink.",
        "applicable_knowledge_types": ["causal"],
        "applicable_topics": ["inflation", "purchasing power", "real vs nominal returns", "time value of money"],
        "props_schema": {
            "initialValue": {"type": "number", "default": 10000, "description": "Starting amount of money"},
            "inflationRate": {"type": "number", "default": 0.03, "description": "Default annual inflation rate"},
            "years": {"type": "number", "default": 30, "description": "Time horizon"},
        },
    },
    {
        "name": "AssetAllocationPie",
        "domain": "finance",
        "description": "Interactive pie/donut chart where the learner can drag sliders to adjust allocation percentages across asset classes and see how it affects expected risk and return.",
        "applicable_knowledge_types": ["structural", "methodological"],
        "applicable_topics": ["asset allocation", "portfolio construction", "diversification", "rebalancing"],
        "props_schema": {
            "allocations": {
                "type": "array of {name, percentage, color}",
                "description": "Initial allocation split",
                "default": "preset 60/40 portfolio",
            },
            "editable": {"type": "boolean", "default": True, "description": "Whether learner can adjust sliders"},
        },
    },
    {
        "name": "ConceptMap",
        "domain": "_universal",
        "description": "Interactive concept map / mind map that shows relationships between concepts. Learner can click nodes to expand or collapse branches. Works for any domain.",
        "applicable_knowledge_types": ["structural", "conceptual"],
        "applicable_topics": ["concepts", "relationships", "structure", "overview", "map"],
        "props_schema": {
            "nodes": {"type": "array of {id, label}", "description": "Concept nodes"},
            "edges": {"type": "array of {source, target, label}", "description": "Relationships"},
        },
    },
    {
        "name": "MultipleChoice",
        "domain": "_universal",
        "description": "Multiple-choice quiz component with immediate feedback. Works for any domain — great for quick knowledge checks.",
        "applicable_knowledge_types": ["factual", "conceptual", "causal"],
        "applicable_topics": ["quiz", "check", "test", "question", "assessment"],
        "props_schema": {
            "question": {"type": "string", "description": "The question text"},
            "options": {"type": "array of string", "description": "Answer choices"},
            "correctIndex": {"type": "number", "description": "0-based index of correct answer"},
            "explanation": {"type": "string", "description": "Explanation shown after answering"},
        },
    },
]


def _format_components(components: list) -> str:
    """Format a list of component dicts into a prompt-friendly text block."""
    if not components:
        return "No interactive components match the current topic. Use text-only teaching."
    lines = ["AVAILABLE INTERACTIVE COMPONENTS (use ONLY these exact names):"]
    for i, comp in enumerate(components, 1):
        lines.append(f"\n{i}. \"{comp['name']}\"")
        lines.append(f"   Use when: {comp['description']}")
        lines.append(f"   Relevant topics: {', '.join(comp['applicable_topics'])}")
        props_parts = []
        for prop_name, prop_info in comp["props_schema"].items():
            default = prop_info.get("default", "")
            props_parts.append(f'"{prop_name}": {default}')
        lines.append(f"   Props example: {{ {', '.join(props_parts)} }}")
    lines.append("\nIf no component above fits the current topic, output text only. NEVER invent component names.")
    return "\n".join(lines)


def get_catalog_for_prompt(unit_topic: str = "", domain: str = "") -> str:
    """Format the component catalog for injection into LLM system prompt.
    Filters by domain (includes domain-specific + _universal components),
    then by topic keyword overlap if unit_topic is provided.
    Falls back to full domain-filtered catalog if no topic match.
    """
    domain_lower = domain.lower().strip() if domain else ""

    if domain_lower:
        domain_filtered = [c for c in COMPONENT_CATALOG
                           if c.get("domain") == "_universal"
                           or domain_lower in c.get("domain", "").lower()
                           or c.get("domain", "").lower() in domain_lower]
    else:
        domain_filtered = COMPONENT_CATALOG

    if not unit_topic:
        return _format_components(domain_filtered)

    topic_lower = unit_topic.lower()
    matched = []
    for comp in domain_filtered:
        for t in comp["applicable_topics"]:
            if t.lower() in topic_lower or topic_lower in t.lower():
                matched.append(comp)
                break

    if not matched:
        return _format_components(domain_filtered)

    return _format_components(matched)


def get_valid_names() -> set:
    """Return the set of valid component names for backend hard validation."""
    return {comp["name"] for comp in COMPONENT_CATALOG}
