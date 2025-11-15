/**
 * Script để ẩn timestamp và chỉ hiển thị khi hover vào message
 */
export function hideTimestamps() {
  if (typeof window === "undefined") return;

  const observer = new MutationObserver(() => {
    // Tìm tất cả messages
    const messages = document.querySelectorAll(
      ".str-chat__message-simple, [class*='message-simple']"
    );

    messages.forEach((message) => {
      // Tìm tất cả elements chứa timestamp pattern
      const allElements = message.querySelectorAll("*");

      allElements.forEach((el) => {
        const text = el.textContent || "";
        // Kiểm tra nếu element chứa timestamp pattern (Today at, Yesterday at, hoặc format date)
        if (
          (text.includes("Today at") ||
            text.includes("Yesterday at") ||
            (text.includes("at") && /\d{1,2}:\d{2}\s*(AM|PM)/.test(text))) &&
          !el.closest(".str-chat__message-simple__message-text") &&
          !el.closest(".str-chat__message-simple__avatar")
        ) {
          const htmlEl = el as HTMLElement;
          htmlEl.style.display = "none";
          htmlEl.style.opacity = "0";
          htmlEl.style.visibility = "hidden";

          // Thêm class để dễ quản lý
          htmlEl.classList.add("timestamp-hidden");
        }
      });

      // Thêm event listener cho hover
      message.addEventListener("mouseenter", () => {
        const hiddenElements = message.querySelectorAll(".timestamp-hidden");
        hiddenElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          htmlEl.style.display = "";
          htmlEl.style.opacity = "1";
          htmlEl.style.visibility = "visible";
        });
      });

      message.addEventListener("mouseleave", () => {
        const hiddenElements = message.querySelectorAll(".timestamp-hidden");
        hiddenElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          htmlEl.style.display = "none";
          htmlEl.style.opacity = "0";
          htmlEl.style.visibility = "hidden";
        });
      });
    });
  });

  // Bắt đầu observe
  const chatContainer = document.querySelector(
    ".str-chat__list, [class*='chat__list']"
  );
  if (chatContainer) {
    observer.observe(chatContainer, {
      childList: true,
      subtree: true,
    });
  }

  // Chạy ngay lần đầu
  setTimeout(() => {
    observer.disconnect();
    const messages = document.querySelectorAll(
      ".str-chat__message-simple, [class*='message-simple']"
    );
    messages.forEach((message) => {
      const allElements = message.querySelectorAll("*");
      allElements.forEach((el) => {
        const text = el.textContent || "";
        if (
          (text.includes("Today at") ||
            text.includes("Yesterday at") ||
            (text.includes("at") && /\d{1,2}:\d{2}\s*(AM|PM)/.test(text))) &&
          !el.closest(".str-chat__message-simple__message-text") &&
          !el.closest(".str-chat__message-simple__avatar")
        ) {
          const htmlEl = el as HTMLElement;
          htmlEl.style.display = "none";
          htmlEl.style.opacity = "0";
          htmlEl.style.visibility = "hidden";
          htmlEl.classList.add("timestamp-hidden");
        }
      });

      message.addEventListener("mouseenter", () => {
        const hiddenElements = message.querySelectorAll(".timestamp-hidden");
        hiddenElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          htmlEl.style.display = "";
          htmlEl.style.opacity = "1";
          htmlEl.style.visibility = "visible";
        });
      });

      message.addEventListener("mouseleave", () => {
        const hiddenElements = message.querySelectorAll(".timestamp-hidden");
        hiddenElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          htmlEl.style.display = "none";
          htmlEl.style.opacity = "0";
          htmlEl.style.visibility = "hidden";
        });
      });
    });
    observer.observe(chatContainer!, {
      childList: true,
      subtree: true,
    });
  }, 1000);
}
