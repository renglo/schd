"""
Scheduler Package
Custom handlers, blueprints, and utilities for the Scheduler platform
"""

from setuptools import setup, find_packages

setup(
    name="schd",
    version="1.0.0",
    description="Scheduler custom handlers, blueprints, and utilities",
    author="Renglo Team",
    packages=find_packages(),
    python_requires=">=3.12",
    install_requires=[
        "requests>=2.32.0",  # For API calls
    ],
    include_package_data=True,
    package_data={
        'schd': ['blueprints/*.json'],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Programming Language :: Python :: 3.12",
    ],
)

