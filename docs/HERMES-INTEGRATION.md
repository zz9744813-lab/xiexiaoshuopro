# Hermes Integration Guide

## Overview

This document describes the integration between xiexiaoshuopro and Hermes Agent.

## Security Boundaries

### Whitelist
- Allowed paths: `/api/health`, `/api/projects/*`, `/api/chapters/*`
- Allowed methods: `GET`, `POST`, `PATCH`
- Rate limit: 60 requests/minute per IP

### Blacklist
- Forbidden paths: `/api/admin`, `/api/system`, `/api/debug`
- Forbidden IP prefixes: (configurable)

## Budget Controls

- Monthly budget: $50 (configurable via `COST_BUDGET_MONTHLY_USD`)
- Circuit breaker triggers at 80% for automated calls
- Hard stop at 100%

## Audit Logging

All Hermes calls are logged to `hermes_audit_log` table with:
- method, path, reason
- caller_ip, response_status
- cost_usd_estimated
- created_at
