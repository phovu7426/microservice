---
description: Quy tac lam viec trong monorepo
globs: "**/*.ts,**/package.json"
---

# Monorepo Workflow

Quan ly bang pnpm workspaces. Cau hinh tai `pnpm-workspace.yaml` (`apps/*` + `packages/*`) va `.npmrc` (strict mode: `hoist=false`).

`pnpm run build:shared` BAT BUOC chay truoc khi build/test bat ky service nao. `pnpm install` co `postinstall` chay san. pnpm `-r` tu dong build theo topological order qua workspace graph.

Thay doi shared (`packages/*`) anh huong TAT CA service phu thuoc — can than khi sua.

Module moi dat trong `apps/<service>/src/modules/<domain>/`, dang ky trong `app.module.ts`.

Strict pnpm: dependency rieng cua tung package PHAI khai bao trong package.json cua chinh package do. Khong duoc dua vao hoisting. Workspace dep dung protocol `workspace:*` (vd `"@package/common": "workspace:*"`).

File .env trong `apps/<service>/.env` — KHONG o root. Docker dung `.env.docker` o root.

Build production: `pnpm run build:shared` → `pnpm --filter <service-name> build`. Dockerfile.service tu dong hoa qua `pnpm deploy --prod`, tao artifact self-contained voi workspace dep da resolve thanh dist/.

Lenh thuong dung trong workspace:
- `pnpm --filter <service> <script>` — chay script trong 1 workspace
- `pnpm -r <script>` — chay recursive theo topo order
- `pnpm --filter "./packages/*" -r build` — build tat ca shared packages
