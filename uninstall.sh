#!/bin/sh
set -eu

echo "Removing LuCI Router Dashboard..."

rm -f /www/luci-static/resources/router-dashboard/dashboard.css
rm -f /www/luci-static/resources/view/router-dashboard/dashboard.js
rm -f /usr/share/luci/menu.d/luci-app-router-dashboard.json
rm -f /usr/share/rpcd/acl.d/luci-app-router-dashboard.json

rmdir /www/luci-static/resources/router-dashboard 2>/dev/null || true
rmdir /www/luci-static/resources/view/router-dashboard 2>/dev/null || true

rm -f /tmp/luci-indexcache
rm -rf /tmp/luci-modulecache/* 2>/dev/null || true

/etc/init.d/rpcd restart
/etc/init.d/uhttpd reload 2>/dev/null || true

echo "Removed."
