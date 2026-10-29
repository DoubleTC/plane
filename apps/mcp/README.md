# BananaZ MCP server

Cho phép trợ lý AI (Claude Code, Cursor, VS Code, Claude Desktop…) đọc và cập nhật dữ liệu BananaZ qua [Model Context Protocol](https://modelcontextprotocol.io): tìm, tạo, sửa công việc; xem cycle, module, Phase; bình luận, gắn link…

Địa chỉ: **`https://pm.cenhomes.net/mcp`**. AI hành động **bằng quyền của chính bạn** trong BananaZ, thông qua token cá nhân.

## 1. Tạo token cá nhân

1. Vào BananaZ → **Cài đặt hồ sơ → Token API** (`https://pm.cenhomes.net/settings/profile/api-tokens`).
2. Tạo token mới, đặt tên dễ nhớ (vd. `Claude Code - laptop`) và hạn dùng. Sao chép token (dạng `plane_api_…`).
3. Ghi lại **slug workspace**: phần ngay sau tên miền trong URL, vd. `technique` trong `https://pm.cenhomes.net/technique/projects`.

Token mang toàn bộ quyền của bạn: không dán vào chat, không commit vào git. Lộ token thì xoá nó ở trang Token API; từ lúc đó mọi thao tác qua MCP bằng token ấy bị BananaZ từ chối.

## 2. Cấu hình ứng dụng

Thay `<TOKEN>` và `<WORKSPACE>` bằng giá trị ở bước 1.

### Claude Code

```bash
claude mcp add --transport http bananaz https://pm.cenhomes.net/mcp \
  --header "Authorization: Bearer <TOKEN>" \
  --header "x-workspace-slug: <WORKSPACE>"
```

Kiểm tra bằng `claude mcp list`, hoặc gõ `/mcp` trong Claude Code.

### Cursor

Thêm vào `~/.cursor/mcp.json` (mọi project) hoặc `.cursor/mcp.json` (một project):

```json
{
  "mcpServers": {
    "bananaz": {
      "url": "https://pm.cenhomes.net/mcp",
      "headers": {
        "Authorization": "Bearer <TOKEN>",
        "x-workspace-slug": "<WORKSPACE>"
      }
    }
  }
}
```

### VS Code (GitHub Copilot, chế độ Agent)

Thêm vào `.vscode/mcp.json` (hoặc lệnh **MCP: Open User Configuration** cho mọi workspace):

```json
{
  "servers": {
    "bananaz": {
      "type": "http",
      "url": "https://pm.cenhomes.net/mcp",
      "headers": {
        "Authorization": "Bearer <TOKEN>",
        "x-workspace-slug": "<WORKSPACE>"
      }
    }
  }
}
```

### Claude Desktop

Claude Desktop kết nối qua [`mcp-remote`](https://www.npmjs.com/package/mcp-remote), nên máy cần cài Node.js (bản 18 trở lên). Mở **Settings → Developer → Edit Config** và thêm vào `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bananaz": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://pm.cenhomes.net/mcp",
        "--header",
        "Authorization:${BANANAZ_AUTH}",
        "--header",
        "x-workspace-slug:${BANANAZ_WORKSPACE}"
      ],
      "env": {
        "BANANAZ_AUTH": "Bearer <TOKEN>",
        "BANANAZ_WORKSPACE": "<WORKSPACE>"
      }
    }
  }
}
```

Giá trị header được đưa qua biến môi trường để tránh lỗi khoảng trắng trong tham số dòng lệnh trên Windows. Khởi động lại Claude Desktop sau khi lưu.

## 3. Dùng được những gì

| Tool                                                      | Việc làm được                                                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `workitem`                                                | liệt kê theo project, tìm kiếm cả workspace, tra theo mã (`WEB-12`), xem, tạo, sửa, xoá, gán người, gán nhãn |
| `workitem_comment`, `workitem_link`, `workitem_activity`  | bình luận, link, lịch sử thay đổi                                                                            |
| `workitem_attachment`                                     | xem danh sách và xoá file đính kèm (tải lên/tải xuống file làm trên giao diện BananaZ)                       |
| `phase`                                                   | Phase của BananaZ: xem, tạo, sửa, xoá, lưu trữ, gắn hoặc gỡ cycle                                            |
| `cycle`, `module`                                         | xem, tạo, sửa, đưa công việc vào hoặc ra, lưu trữ                                                            |
| `project`, `state`, `label`, `intake`, `project_estimate` | dữ liệu cấu hình project                                                                                     |
| `member`, `workspace`                                     | thành viên, workspace đang kết nối                                                                           |

Không có trên BananaZ (chỉ có ở bản thương mại của Plane): page, milestone, loại công việc và thuộc tính tuỳ chỉnh (nên không có epic), worklog, template, initiative, release, customer, collection, quan hệ giữa công việc, lọc bằng PQL.

Phase chỉ dùng được khi project đã bật **Phases** trong cài đặt project. Chỉ admin project hoặc người tạo Phase mới xoá được Phase.

**An toàn khi để AI tự thao tác:** AI đọc nội dung do người khác viết (mô tả công việc, bình luận), trong đó có thể có câu lệnh cài cắm (prompt injection). Hãy để ứng dụng AI **hỏi bạn trước khi tạo, sửa hoặc xoá** (mặc định của Claude Code, Cursor, VS Code, Claude Desktop) thay vì cho phép tự động mọi thao tác ghi.

Mỗi token được gọi API BananaZ tối đa 60 lần/phút. Nếu AI làm việc dày đặc và báo lỗi 429, chờ một phút rồi thử lại.

## 4. Vận hành (admin)

Service `mcp` trong `docker-compose-prod.yml` dùng image `registry2.cenhomes.vn/doubletc/banana/mcp`, được build cùng các image khác bởi `build-and-push.sh`. Caddy (image `proxy`) chuyển `/mcp` và `/mcp/*` vào cổng 8211 của service này.

| Biến môi trường          | Mặc định | Ý nghĩa                                                                            |
| ------------------------ | -------- | ---------------------------------------------------------------------------------- |
| `PLANE_BASE_URL`         | —        | URL nội bộ của API BananaZ, vd. `http://api:8000`                                  |
| `AUTH_CACHE_TTL_SECONDS` | `60`     | thời gian nhớ một token đã xác thực (đồng thời là độ trễ tối đa khi thu hồi token) |
| `LOG_PAYLOADS`           | `false`  | ghi cả tham số tool vào log (chứa nội dung công việc, chỉ bật khi cần gỡ lỗi)      |
| `PORT`                   | `8211`   | cổng HTTP                                                                          |

Health check: `GET /mcp/health` → `{"status": "ok"}`. Log ở dạng JSON trên stderr.

## 5. Phát triển

Thư mục này là project Python độc lập, không thuộc pnpm workspace. Code dựa trên [`plane-mcp-server`](https://github.com/makeplane/plane-mcp-server) chính thức, được cố định phiên bản trong `pyproject.toml`:

- `bananaz_mcp/compat.py`: chỉ đăng ký tool mà BananaZ phục vụ được, thu hẹp các tool hỗ trợ một phần (bỏ action, ẩn tham số như `pql`, viết lại mô tả), và vá model SDK cho lịch sử thay đổi.
- `bananaz_mcp/phase.py`: tool `phase`, gọi `/api/v1/.../phases/` của BananaZ.
- `bananaz_mcp/auth.py`: xác thực token cá nhân, có cache ngắn hạn để tiết kiệm hạn mức API.
- `bananaz_mcp/server.py`: dựng server, kèm hướng dẫn hệ thống gửi cho AI.

```bash
python3.12 -m venv .venv && . .venv/bin/activate
pip install -r requirements.lock && pip install -e ".[dev]"
pytest
ruff check . && ruff format --check .
```

Chạy thử cục bộ với stdio (không cần HTTP):

```bash
PLANE_BASE_URL=http://localhost:8000 PLANE_API_KEY=<TOKEN> PLANE_WORKSPACE_SLUG=<WORKSPACE> bananaz-mcp stdio
```

Nâng cấp `plane-mcp-server`:

1. Đổi phiên bản trong `pyproject.toml`.
2. Tạo lại `requirements.lock` trên `python:3.12-alpine` (cùng ảnh nền với `Dockerfile`): cài `plane-mcp-server==<phiên bản mới>` vào một virtualenv trống rồi chạy `pip freeze`.
3. Chạy `pytest`. Test sẽ báo lỗi nếu danh mục tool hoặc các phần nội bộ mà lớp tương thích đang dùng thay đổi.
4. Thử đầu-cuối với một instance BananaZ dev trước khi deploy.
