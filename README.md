# LuCI Dashboard 2026

Modern standalone dashboard for OpenWrt LuCI.

The project does **not** replace or patch stock LuCI. It adds a separate page at:

**Status -> Router Dashboard**

## Current dashboard

- WAN / Internet status with masked public IPv4
- Router model, firmware and uptime
- CPU load
- RAM usage
- SoC temperature
- Wi-Fi networks and connected client count
- AdGuard Home detection and controls
- Forkop detection and controls
- sing-box detection and controls
- Start / stop / restart buttons for detected services
- Responsive light/dark UI

## Target

Modern OpenWrt releases using JavaScript LuCI views.

The current implementation is designed around the current LuCI JS API and avoids legacy Lua controllers.

## Repository layout

```
luci-app-router-dashboard/
  Makefile
  htdocs/luci-static/resources/
    router-dashboard/dashboard.css
    view/router-dashboard/dashboard.js
  root/usr/share/
    luci/menu.d/luci-app-router-dashboard.json
    rpcd/acl.d/luci-app-router-dashboard.json

install.sh
uninstall.sh
```

## Quick development install

Copy or clone the repository onto the router and run:

```sh
chmod +x install.sh uninstall.sh
./install.sh
```

Then refresh LuCI and open:

**Status -> Router Dashboard**

To remove it:

```sh
./uninstall.sh
```

## Build as an OpenWrt package

Copy `luci-app-router-dashboard` into the OpenWrt buildroot or SDK package tree, for example:

```sh
cp -r luci-app-router-dashboard /path/to/openwrt/package/
cd /path/to/openwrt
make package/luci-app-router-dashboard/compile V=s
```

## Optional services

AdGuard Home, Forkop and sing-box are optional.

If one of them is not installed, it is simply omitted from the Services card.

## Notes

The dashboard masks an IPv4 address such as:

```
80.189.23.41 -> 80.189.*.*
```

The stock LuCI pages remain available and unchanged.
