import sys
import joblib
import numpy as np  # Đối với mô hình sử dụng numpy

# Load mô hình từ file pickle
model = joblib.load('D:/Study/N4 - HK1/KLTN/Data Model/svm_model.pkl')

# Load input data from command-line arguments
pH = float(sys.argv[1])
TDS = float(sys.argv[2])
cond = float(sys.argv[6])

input_data = np.array([[pH, TDS, 0, 0, 0, cond, 0, 0, 0]])

# Thực hiện dự đoán
prediction = model.predict(input_data)

# In kết quả dự đoán
print(prediction)




