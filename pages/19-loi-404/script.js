document.getElementById('go-back').addEventListener('click', () => history.length > 1 ? history.back() : location.assign('../01-dang-nhap/login.html'));
