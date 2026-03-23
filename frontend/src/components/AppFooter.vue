<template>
  <footer class="footer">
    <div class="footer-content">
      <div class="footer-left">
        <span class="copyright">© 2026 NewsCenter, Inc.</span>
      </div>

    </div>
  </footer>
</template>

<script>
export default {
  name: "AppFooter"
};
</script>

<style scoped>
.footer {
  background: radial-gradient(1200px 600px at 15% 10%, rgba(120,160,255,0.18), transparent 60%),
              radial-gradient(900px 500px at 80% 0%, rgba(255,255,255,0.08), transparent 50%),
              #0b0f16;
  padding: 20px 0;
  margin-top: 40px; /* Abstand zum Inhalt darüber */
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
}

.brand {
  font-weight: 800;
  color: #e9eefc;
  margin-right: 10px;
}

.copyright {
  color: #a0aec0;
  font-size: 0.9rem;
}

.footer-links {
  display: flex;
  gap: 20px;
}

.footer-links a {
  color: #a0aec0;
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.2s;
}

.footer-links a:hover {
  color: #42b983;  /*Deine Akzentfarbe */
}
</style>