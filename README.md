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

## One-command install

Run on the router:

```sh
uclient-fetch -qO- https://raw.githubusercontent.com/Fovway/Luci-dashboard-2026/main/install-online.sh | sh
```

If `uclient-fetch` is unavailable:

```sh
wget -qO- https://raw.githubusercontent.com/Fovway/Luci-dashboard-2026/main/install-online.sh | sh
```

Then open:

**LuCI -> Status -> Router Dashboard**

## Development install

Clone or copy the repository onto the router and run:

```sh
chmod +x install.sh uninstall.sh
./install.sh
```

To remove it:

```sh
./uninstall.sh
```

## Build as an OpenWrt package

Copy `luci-app-router-dashboard` into the OpenWrt buildroot package tree:

```sh
cp -r luci-app-router-dashboard /path/to/openwrt/package/
cd /path/to/openwrt
make package/luci-app-router-dashboard/compile V=s
```

The package uses the current JavaScript LuCI API and `feeds/luci/luci.mk`, so it can be built as an external package inside a normal OpenWrt buildroot.

## Repository layout

```text
luci-app-router-dashboard/
  Makefile
  htdocs/luci-static/resources/
    router-dashboard/dashboard.css
    view/router-dashboard/dashboard.js
  root/usr/share/
    luci/menu.d/luci-app-router-dashboard.json
    rpcd/acl.d/luci-app-router-dashboard.json

install.sh
install-online.sh
uninstall.sh
```

## Optional services

AdGuard Home, Forkop and sing-box are optional. Missing services are simply omitted from the Services card.

## Privacy

The dashboard masks public IPv4 addresses:

```text
80.189.23.41 -> 80.189.*.*
```

The stock LuCI pages remain available and unchanged.
