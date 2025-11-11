#!/usr/bin/env python3
"""
Example usage of Scheduler handlers
Demonstrates how to use handlers with sample data
"""

import json
from scheduler import get_handler, list_handlers


def test_dynamic_loading():
    """Test dynamic handler loading"""
    print("=" * 60)
    print("Testing Dynamic Handler Loading")
    print("=" * 60)
    
    # List all handlers
    print("\nAvailable handlers:")
    handlers = list_handlers()
    if handlers:
        for handler_name in handlers:
            print(f"  - {handler_name}")
    else:
        print("  No handlers registered yet.")
        print("  Add handlers to scheduler/handlers/ and register them in scheduler/__init__.py")


if __name__ == '__main__':
    print("\nScheduler Handlers - Example Usage\n")
    
    # Run tests
    test_dynamic_loading()
    
    print("\n" + "=" * 60)
    print("Tests completed!")
    print("=" * 60)

