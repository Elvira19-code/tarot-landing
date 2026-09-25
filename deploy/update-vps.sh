#!/usr/bin/env bash
set -Eeuo pipefail
umask 022
[[ $EUID -eq 0 ]] || { echo 'Run as root'; exit 1; }
sha=${1:-}
[[ $sha =~ ^[0-9a-f]{40}$ ]] || { echo 'Pass an exact reviewed Git commit SHA'; exit 1; }
exec 9>/run/lock/taroway-deploy.lock
flock -n 9 || { echo 'Deployment already running'; exit 1; }
nodebin=/opt/node-v24.21.0-linux-x64/bin
release=/opt/taroway/releases/$sha
public=/var/www/taroway-releases/$sha
[[ ! -e $release && ! -e $public ]] || { echo 'Release already exists; inspect before retrying'; exit 1; }
old_api=$(readlink -f /opt/taroway/site)
old_public=$(readlink -f /var/www/taroway)
[[ -f $old_api/server/app.mjs && -f $old_public/index.html ]] || exit 1
install -d -m 755 /opt/taroway/releases /var/www/taroway-releases
install -d -o taroway -g taroway -m 755 "$release"
archive=$(mktemp /var/tmp/taroway-release.XXXXXX.tar.gz)
trap 'rm -f "$archive"' EXIT
curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 --max-time 180 \
  "https://codeload.github.com/Elvira19-code/tarot-landing/tar.gz/$sha" -o "$archive"
chmod 644 "$archive"
runuser -u taroway -- tar -xzf "$archive" --strip-components=1 -C "$release"
cd "$release"
runuser -u taroway -- env PATH="$nodebin:$PATH" npm ci
runuser -u taroway -- env PATH="$nodebin:$PATH" bash -c 'node --test server/*.test.mjs'
runuser -u taroway -- env PATH="$nodebin:$PATH" npm run build
install -d -m 755 "$public"
cp -r "$release/dist/." "$public/"
printf '{"revision":"%s"}\n' "$sha" > "$public/release.json"
python3 /usr/local/lib/taroway/backup.py
nginx -t
# First migration preserves the existing public directory as the rollback target.
if [[ ! -L /var/www/taroway ]]; then
  old_public=/var/www/taroway-releases/before-$(date -u +%Y%m%dT%H%M%S)
  mv /var/www/taroway "$old_public"
  ln -s "$old_public" /var/www/taroway
fi
rollback() {
  trap - ERR
  ln -sfn "$old_api" /opt/taroway/site.next
  mv -Tf /opt/taroway/site.next /opt/taroway/site
  ln -sfn "$old_public" /var/www/taroway.next
  mv -Tf /var/www/taroway.next /var/www/taroway
  systemctl restart taroway-api
  echo 'Deployment failed; previous code and public files restored. Database not rolled back.' >&2
  exit 1
}
trap rollback ERR
ln -sfn "$release" /opt/taroway/site.next
mv -Tf /opt/taroway/site.next /opt/taroway/site
ln -sfn "$public" /var/www/taroway.next
mv -Tf /var/www/taroway.next /var/www/taroway
systemctl restart taroway-api
curl --noproxy '*' --fail --silent --show-error --retry 5 --retry-connrefused --retry-delay 1 \
  --max-time 10 http://127.0.0.1:4325/api/availability -o /dev/null
curl --noproxy '*' --fail --silent --show-error --resolve taroway.com:443:127.0.0.1 \
  --max-time 15 https://taroway.com/order/ -o /dev/null
curl --noproxy '*' --fail --silent --show-error --resolve taroway.com:443:127.0.0.1 \
  --max-time 15 https://taroway.com/release.json | grep -F "$sha"
trap - ERR
echo "Deployment OK: $sha"
