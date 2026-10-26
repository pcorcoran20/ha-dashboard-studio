#!/usr/bin/with-contenv bashio
# ╭──────────────────────────────────────────────────────╮
# │                                                      │
# │          ,,                                          │
# │        <(o )___           ✦ PATRICK'S NEST ✦         │
# │         ( ._> /           quackomation for HA        │
# │          `---'            hatched with love          │
# │      __       __       __                            │
# │    <(o )__  <(o )__  <(o )__    (the interns)        │
# │     (._>/    (._>/    (._>/     unpaid. underfoot.   │
# │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  │
# │                                                      │
# │   file     : run.sh                                  │
# │   author   : Patrick (and the interns)               │
# │   hatched  : 2026-10-26                              │
# │   license  : Muscovy Public License (joke, see       │
# │              LICENSE file for the real one)          │
# │   status   : no ducks harmed. all fed. one is        │
# │              sitting on the keyboard.                │
# │                                                      │
# ╰──────────────────────────────────────────────────────╯

# with-contenv hands the add-on's environment (including SUPERVISOR_TOKEN) to the server
bashio::log.info "Starting Dashboard Studio"
exec python3 /app/server.py
