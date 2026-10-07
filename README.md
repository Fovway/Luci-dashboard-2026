# LuCI Dashboard 2026

Modern dashboard for OpenWrt LuCI.

Designed as a standalone LuCI application so it does not replace or patch the stock LuCI interface.

## Current dashboard

- WAN / Internet status and IPv4 address
- Router model, firmware and uptime
- System load, RAM usage and temperature
- Wi-Fi networks and connected client count
- AdGuard Home status
- Forkop status
- sing-box status
- One-click service restart
- Responsive light/dark UI

## Target

Primary target: modern OpenWrt releases with JavaScript LuCI views.

## Package layout

```
Makefile
htdocs/luci-static/resources/
  router-dashboard/dashboard.css
  view/router-dashboard/overview.js
root/usr/share/
  luci/menu.d/luci-app-router-dashboard.json
  rpcd/acl.d/luci-app-router-dashboard.json
```

## Development install

Copy the repository to the router and run:

```sh
chmod +x install.sh
./install.sh
```

Then open LuCI and go to **Status -> Router Dashboard**.

## Build as an OpenWrt package

Place this repository in an OpenWrt SDK/package tree, refresh feeds if needed and build:

```sh
make package/luci-app-router-dashboard/compile V=s
```

The package is intentionally independent from AdGuard Home, Forkop and sing-box. If any of them is not installed, the dashboard simply shows it as unavailable.
